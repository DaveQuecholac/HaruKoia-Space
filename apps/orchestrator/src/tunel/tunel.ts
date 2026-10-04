/**
 * El túnel del orquestador. Fijado en el paso B3, con la forma de **D3**.
 *
 * El host no acepta conexiones entrantes, así que nadie puede llamarlo. La
 * secuencia es:
 *
 *   1. El host abre su conexión de **control** y registra su sala.
 *   2. Un invitado llega y manda su token. El orquestador lo valida.
 *   3. El orquestador avisa al host por control, con un ticket de un solo uso.
 *   4. El host **abre una conexión de datos saliente** y devuelve el ticket.
 *   5. El orquestador pega las dos puntas y **deja de mirar**.
 *
 * Desde el paso 5 este archivo solo copia bytes. No sabe qué transporta y no
 * debe saberlo: cuando entre el canal de réplica, aquí no se cambia nada.
 */

import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import {
  CODIGO_DE_SALA_CERRADA,
  type CausaDeCierre,
  type IdentificadorDeConexion,
  type IdentificadorDeSala,
  type MensajeDeControl,
  RUTAS,
  TAMANO_MAXIMO_DE_MENSAJE,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';
import { WebSocket, WebSocketServer } from 'ws';

import { crearRegistroDeSalas, type RegistroDeSalas } from '../registro-de-salas/registro-de-salas.ts';
import { crearEmparejador, type Emparejador } from './emparejamiento/emparejamiento.ts';
import { COLA_MAXIMA_POR_CONEXION } from './limites/limites.ts';

export type OpcionesDelTunel = {
  readonly registro: Registro;
  readonly caducidadDelEmparejamiento?: number;
  readonly toleranciaSinLatido?: number;
  /** Reloj inyectable para las pruebas del barrido. */
  readonly reloj?: () => number;
};

export type Tunel = {
  readonly salas: RegistroDeSalas;
  readonly emparejamientosPendientes: () => number;
  /** Pares invitado–host vivos. */
  readonly conexionesUnidas: () => number;
  /** Sockets abiertos en el orquestador, de cualquier ruta. */
  readonly socketsAbiertos: () => number;
  /**
   * Retira las salas sin latido, avisa a su host y echa a sus invitados.
   * El proceso es quien lo llama, cada `INTERVALO_DE_BARRIDO`.
   */
  readonly barrer: () => void;
  /**
   * Apagado limpio: cierra todos los sockets con 1001 ("el servidor se va")
   * para que hosts e invitados reconecten de inmediato, sin esperar a que
   * venza un latido.
   */
  readonly cerrarConexiones: () => void;
  readonly desmontar: () => void;
};

/** Un par unido, visto desde fuera de `unirPuntas`. */
type Puntas = {
  /** El host cerró la sala: el invitado recibe el código propio y la causa. */
  readonly cerrarPorSalaCerrada: (causa: CausaDeCierre) => void;
};

function enviarControl(socket: WebSocket, mensaje: MensajeDeControl): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(serializarControl(mensaje));
}

/** Rechaza con causa y cierra. Nunca se cierra en silencio. */
function rechazar(socket: WebSocket, mensaje: MensajeDeControl): void {
  enviarControl(socket, mensaje);
  socket.close(1008);
}

/**
 * Copia bytes en los dos sentidos hasta que una punta se cierra, y entonces
 * cierra la otra. Aplica los topes de tamaño y de cola.
 */
function unirPuntas(
  invitado: WebSocket,
  datos: WebSocket,
  registroDeLaConexion: Registro,
  alCerrar: () => void,
): Puntas {
  let cerrado = false;

  const cerrarTodo = (motivo: string, causaDeSala?: CausaDeCierre): void => {
    if (cerrado) return;
    cerrado = true;
    registroDeLaConexion.info('puntas separadas', { motivo });
    if (invitado.readyState === WebSocket.OPEN) {
      if (causaDeSala === undefined) invitado.close(1000);
      else invitado.close(CODIGO_DE_SALA_CERRADA, causaDeSala);
    }
    if (datos.readyState === WebSocket.OPEN) datos.close(1000);
    alCerrar();
  };

  const copiar = (origen: WebSocket, destino: WebSocket, sentido: string): void => {
    origen.on('message', (bytes: Buffer, esBinario: boolean) => {
      if (bytes.length > TAMANO_MAXIMO_DE_MENSAJE) {
        registroDeLaConexion.aviso('mensaje descartado por tamaño', {
          sentido,
          bytes: bytes.length,
        });
        cerrarTodo('mensaje demasiado grande');
        return;
      }

      if (destino.bufferedAmount > COLA_MAXIMA_POR_CONEXION) {
        registroDeLaConexion.aviso('extremo que no drena', {
          sentido,
          cola: destino.bufferedAmount,
        });
        cerrarTodo('cola llena');
        return;
      }

      if (destino.readyState === WebSocket.OPEN) destino.send(bytes, { binary: esBinario });
    });

    origen.on('close', () => cerrarTodo(`cerró ${sentido}`));
    origen.on('error', () => cerrarTodo(`error en ${sentido}`));
  };

  copiar(invitado, datos, 'invitado');
  copiar(datos, invitado, 'host');

  return {
    cerrarPorSalaCerrada: (causa) => cerrarTodo('sala cerrada', causa),
  };
}

export function montarTunel(servidor: Server, opciones: OpcionesDelTunel): Tunel {
  const { registro } = opciones;

  const salas = crearRegistroDeSalas({
    registro,
    ...(opciones.toleranciaSinLatido === undefined
      ? {}
      : { toleranciaSinLatido: opciones.toleranciaSinLatido }),
    ...(opciones.reloj === undefined ? {} : { reloj: opciones.reloj }),
  });

  const emparejador: Emparejador<WebSocket> = crearEmparejador<WebSocket>({
    registro,
    ...(opciones.caducidadDelEmparejamiento === undefined
      ? {}
      : { caducidad: opciones.caducidadDelEmparejamiento }),
  });

  const servidorDeSockets = new WebSocketServer({
    noServer: true,
    maxPayload: TAMANO_MAXIMO_DE_MENSAJE,
  });

  /**
   * Conexiones unidas: para avisarle al host cuando un invitado se va, y para
   * cerrar a los invitados de una sala cuando su host la cierra.
   */
  const unidas = new Map<IdentificadorDeConexion, { sala: IdentificadorDeSala; puntas: Puntas }>();

  const alUpgrade = (peticion: IncomingMessage, socket: Duplex, cabecera: Buffer): void => {
    const ruta = new URL(peticion.url ?? '/', 'http://interno').pathname;

    if (ruta !== RUTAS.control && ruta !== RUTAS.invitado && ruta !== RUTAS.datos) {
      // Sin esto el socket se queda colgado y el cliente acaba viendo un cierre
      // anormal sin explicación. Un 404 falla de inmediato y no deja el socket
      // abierto: no hay handshake todavía, así que la respuesta es HTTP.
      registro.aviso('actualización rechazada: ruta desconocida', { ruta });
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    servidorDeSockets.handleUpgrade(peticion, socket, cabecera, (conexion) => {
      atender(ruta, conexion);
    });
  };

  servidor.on('upgrade', alUpgrade);

  function atender(ruta: string, socket: WebSocket): void {
    // Las tres rutas empiezan hablando control. El primer mensaje decide.
    socket.once('message', (bytes: Buffer) => {
      const leido = interpretarControl(bytes.toString('utf8'));

      if (!leido.ok) {
        rechazar(socket, { tipo: 'entrada-rechazada', causa: leido.causa });
        return;
      }

      const mensaje = leido.mensaje;

      if (ruta === RUTAS.control && mensaje.tipo === 'registrar') {
        atenderControlDelHost(socket, mensaje);
        return;
      }
      if (ruta === RUTAS.invitado && mensaje.tipo === 'entrar') {
        atenderInvitado(socket, mensaje);
        return;
      }
      if (ruta === RUTAS.datos && mensaje.tipo === 'emparejar') {
        atenderDatosDelHost(socket, mensaje);
        return;
      }

      rechazar(socket, { tipo: 'entrada-rechazada', causa: 'mensaje-no-reconocido' });
    });
  }

  function atenderControlDelHost(
    socket: WebSocket,
    registroDeSala: Extract<MensajeDeControl, { tipo: 'registrar' }>,
  ): void {
    const { sala, tokenDeHost, tokenDeInvitacion } = registroDeSala;

    const alta = salas.registrar({
      sala,
      tokenDeHost,
      tokenDeInvitacion,
      enlace: {
        enviar: (texto) => {
          if (socket.readyState === WebSocket.OPEN) socket.send(texto);
        },
        cerrar: (causa) => {
          enviarControl(socket, { tipo: 'sala-cerrada', causa });
          socket.close(1000);
        },
      },
    });

    if (!alta.ok) {
      rechazar(socket, { tipo: 'registro-rechazado', causa: alta.causa });
      return;
    }

    enviarControl(socket, { tipo: 'registro-aceptado', sala });
    const registroDeLaSala = registro.con({ sala });

    socket.on('message', (bytes: Buffer) => {
      const leido = interpretarControl(bytes.toString('utf8'));

      if (!leido.ok) {
        enviarControl(socket, { tipo: 'registro-rechazado', causa: leido.causa });
        return;
      }

      if (leido.mensaje.tipo === 'latido') {
        const pulso = salas.latido(sala, tokenDeHost);
        if (!pulso.ok) enviarControl(socket, { tipo: 'registro-rechazado', causa: pulso.causa });
        return;
      }
      if (leido.mensaje.tipo === 'cambiar-invitacion') {
        const cambio = salas.cambiarInvitacion(sala, tokenDeHost, leido.mensaje.tokenDeInvitacion);
        enviarControl(
          socket,
          cambio.ok ? { tipo: 'invitacion-cambiada' } : { tipo: 'registro-rechazado', causa: cambio.causa },
        );
        return;
      }
      if (leido.mensaje.tipo === 'cerrar-sala') {
        echarInvitadosDe(sala, 'host-cerro-la-sala');
        salas.cerrar(sala, tokenDeHost);
        return;
      }

      enviarControl(socket, { tipo: 'registro-rechazado', causa: 'mensaje-no-reconocido' });
    });

    socket.on('close', () => {
      // No se da de baja la sala: el host puede estar reconectando y su
      // registro caduca por latido. Decisión D5.
      registroDeLaSala.aviso('conexión de control cerrada');
    });
  }

  function echarInvitadosDe(sala: IdentificadorDeSala, causa: CausaDeCierre): void {
    for (const pendiente of emparejador.deLaSala(sala)) {
      emparejador.cancelar(pendiente.conexion);
      if (pendiente.invitado.readyState === WebSocket.OPEN) {
        pendiente.invitado.close(CODIGO_DE_SALA_CERRADA, causa);
      }
    }
    for (const unida of [...unidas.values()]) {
      if (unida.sala === sala) unida.puntas.cerrarPorSalaCerrada(causa);
    }
  }

  function atenderInvitado(
    socket: WebSocket,
    entrada: Extract<MensajeDeControl, { tipo: 'entrar' }>,
  ): void {
    const { sala, tokenDeInvitacion } = entrada;

    const valido = salas.validarInvitacion(sala, tokenDeInvitacion);
    if (!valido.ok) {
      rechazar(socket, { tipo: 'entrada-rechazada', causa: valido.causa });
      return;
    }

    const registrada = salas.resolver(sala);
    if (!registrada) {
      rechazar(socket, { tipo: 'entrada-rechazada', causa: 'sala-no-encontrada' });
      return;
    }

    const { conexion, ticket } = emparejador.abrir({ sala, canal: 'sesion', invitado: socket });

    const caducar = setTimeout(() => {
      for (const caido of emparejador.barrer()) {
        rechazar(caido.invitado, {
          tipo: 'entrada-rechazada',
          causa: 'emparejamiento-expirado',
        });
      }
    }, (opciones.caducidadDelEmparejamiento ?? 10_000) + 50);
    caducar.unref();

    socket.once('close', () => {
      clearTimeout(caducar);
      emparejador.cancelar(conexion);
    });

    registrada.enlace.enviar(
      serializarControl({ tipo: 'entra-invitado', conexion, canal: 'sesion', ticket }),
    );
  }

  function atenderDatosDelHost(
    socket: WebSocket,
    emparejar: Extract<MensajeDeControl, { tipo: 'emparejar' }>,
  ): void {
    const reclamo = emparejador.reclamar(emparejar.conexion, emparejar.ticket);

    if (!reclamo.ok) {
      rechazar(socket, { tipo: 'emparejamiento-rechazado', causa: reclamo.causa });
      return;
    }

    const { conexion, sala, invitado } = reclamo.pendiente;
    const registroDeLaConexion = registro.con({ sala, conexion });

    // Las dos puntas se enteran antes de que pase el primer byte: desde aquí
    // ninguna de las dos vuelve a ver control.
    enviarControl(socket, { tipo: 'emparejamiento-aceptado', conexion });
    enviarControl(invitado, { tipo: 'entrada-aceptada', conexion });

    const puntas = unirPuntas(invitado, socket, registroDeLaConexion, () => {
      unidas.delete(conexion);
      salas.resolver(sala)?.enlace.enviar(serializarControl({ tipo: 'sale-invitado', conexion }));
    });
    unidas.set(conexion, { sala, puntas });
  }

  return {
    salas,
    emparejamientosPendientes: emparejador.pendientes,
    conexionesUnidas: () => unidas.size,
    socketsAbiertos: () => servidorDeSockets.clients.size,
    barrer: () => {
      for (const sala of salas.barrer()) echarInvitadosDe(sala, 'host-sin-latido');
    },
    cerrarConexiones: () => {
      for (const socket of servidorDeSockets.clients) socket.close(1001);
    },
    desmontar: () => {
      servidor.off('upgrade', alUpgrade);
      servidorDeSockets.close();
    },
  };
}
