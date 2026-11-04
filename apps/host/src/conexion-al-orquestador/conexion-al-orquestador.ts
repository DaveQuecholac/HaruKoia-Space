/**
 * Conexión del host al orquestador. Fijado en el paso B4.
 *
 * El host nunca acepta conexiones: **marca hacia fuera** (D3). Esta pieza
 * mantiene viva la conexión de control y, por ella, el registro de su sala:
 *
 *   - al arrancar se registra, aunque el orquestador todavía no exista;
 *   - late cada diez segundos para que el orquestador no lo dé por muerto;
 *   - detecta una conexión muerta en silencio (suspender la máquina, perder la
 *     red) con ping y pong, porque escribir en un socket muerto no falla;
 *   - reconecta con espera creciente, y deja de hacerlo ante un rechazo que
 *     reintentar no arregla;
 *   - ante cada invitado abre una conexión de datos saliente.
 *
 * Nunca termina el proceso por un fallo de red: un host que muere porque el
 * orquestador se reinició es exactamente el error que este paso evita.
 */

import {
  type IdentidadDeSala,
  RUTAS,
  type TokenDeInvitacion,
  TAMANO_MAXIMO_DE_MENSAJE,
  interpretarControl,
  serializarControl,
  urlDelRelay,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';
import { WebSocket } from 'ws';

import { abrirConexionDeDatos, type ManejadoresDeCanal } from './conexion-de-datos/conexion-de-datos.ts';
import { crearEsperaCreciente, type EsperaCreciente } from './espera-creciente/espera-creciente.ts';
import { esCierreDefinitivo, esRechazoDefinitivo } from './rechazo-definitivo/rechazo-definitivo.ts';

/** Diez segundos: tres latidos caben en la tolerancia de 30 s del orquestador. */
export const INTERVALO_DE_LATIDO = 10_000;

/** Lo que tarda `detener` en rendirse si el orquestador no contesta el cierre. */
const ESPERA_DEL_CIERRE = 2_000;

/** Lo que se espera la confirmación de `cambiar-invitacion` antes de darlo por fallido. */
const ESPERA_DEL_CAMBIO_DE_INVITACION = 5_000;

export type EstadoDeLaConexion =
  | 'conectando'
  | 'registrada'
  | 'esperando'
  | 'detenida'
  | 'rechazada';

export type OpcionesDeConexion = {
  /** Base del orquestador, por ejemplo `wss://orquestador.ejemplo.com`. */
  readonly url: string;
  readonly identidad: IdentidadDeSala;
  readonly manejadores: ManejadoresDeCanal;
  readonly registro: Registro;
  readonly espera?: EsperaCreciente;
  readonly intervaloDeLatido?: number;
};

export type ConexionAlOrquestador = {
  readonly estado: () => EstadoDeLaConexion;
  /** El token con el que se entra ahora. Cambia con `cambiarInvitacion`. */
  readonly invitacionVigente: () => TokenDeInvitacion;
  /**
   * B8: pide al orquestador que solo acepte `nuevo`. Resuelve `true` cuando lo
   * confirma; `false` si no está registrada, no contesta o lo rechaza. Solo
   * con `true` cambia la invitación vigente.
   */
  readonly cambiarInvitacion: (nuevo: TokenDeInvitacion) => Promise<boolean>;
  /** Suelta la sala en el orquestador y cierra todo. No vuelve a conectar. */
  readonly detener: () => Promise<void>;
};

export function conectarAlOrquestador(opciones: OpcionesDeConexion): ConexionAlOrquestador {
  const { identidad, manejadores } = opciones;
  const registro = opciones.registro.con({ sala: identidad.sala });
  const espera = opciones.espera ?? crearEsperaCreciente();
  const intervaloDeLatido = opciones.intervaloDeLatido ?? INTERVALO_DE_LATIDO;
  const datosAbiertos = new Set<WebSocket>();

  let estado: EstadoDeLaConexion = 'conectando';
  let control: WebSocket | undefined;
  let latido: ReturnType<typeof setInterval> | undefined;
  let reintento: ReturnType<typeof setTimeout> | undefined;
  let tokenDeInvitacion = identidad.tokenDeInvitacion;
  let cambioPendiente: { readonly nuevo: TokenDeInvitacion; readonly terminar: (ok: boolean) => void } | undefined;

  const terminal = (): boolean => estado === 'detenida' || estado === 'rechazada';

  function abrir(): void {
    estado = 'conectando';
    const socket = new WebSocket(urlDelRelay(opciones.url, RUTAS.control), {
      maxPayload: TAMANO_MAXIMO_DE_MENSAJE,
    });
    control = socket;

    socket.on('open', () => {
      socket.send(
        serializarControl({
          tipo: 'registrar',
          sala: identidad.sala,
          tokenDeHost: identidad.tokenDeHost,
          tokenDeInvitacion,
        }),
      );
    });

    socket.on('message', (bytes: Buffer, esBinario: boolean) => {
      if (control === socket) atender(socket, bytes, esBinario);
    });

    socket.on('error', (falla) => {
      registro.aviso('conexión de control con error', { causa: falla.message });
    });

    socket.on('close', (codigo) => {
      if (control !== socket) return;
      detenerLatido();
      control = undefined;
      cambioPendiente?.terminar(false);
      if (!terminal()) programarReintento(codigo);
    });
  }

  function atender(socket: WebSocket, bytes: Buffer, esBinario: boolean): void {
    if (esBinario) {
      registro.aviso('llegó binario por la conexión de control; se ignora');
      return;
    }

    const leido = interpretarControl(bytes.toString('utf8'));
    if (!leido.ok) {
      registro.aviso('control ilegible del orquestador', { causa: leido.causa });
      return;
    }

    const mensaje = leido.mensaje;

    switch (mensaje.tipo) {
      case 'registro-aceptado':
        estado = 'registrada';
        espera.reiniciar();
        iniciarLatido(socket);
        registro.info('sala registrada en el orquestador');
        return;

      case 'invitacion-cambiada':
        if (!cambioPendiente) {
          registro.aviso('confirmación de cambio de invitación que nadie pidió');
          return;
        }
        tokenDeInvitacion = cambioPendiente.nuevo;
        cambioPendiente.terminar(true);
        registro.info('invitación cambiada en el orquestador');
        return;

      case 'registro-rechazado':
        // Ya registrada, el rechazo es de un mensaje posterior, no del registro:
        // la sala sigue en pie y no hay que soltar la conexión.
        if (estado === 'registrada' && cambioPendiente) {
          registro.aviso('el orquestador rechazó el cambio de invitación', { causa: mensaje.causa });
          cambioPendiente.terminar(false);
          return;
        }
        if (esRechazoDefinitivo(mensaje.causa)) {
          estado = 'rechazada';
          registro.error('el orquestador rechazó la sala; no se reintenta', { causa: mensaje.causa });
        } else {
          registro.aviso('registro rechazado; se reintenta', { causa: mensaje.causa });
        }
        socket.close(1000);
        return;

      case 'sala-cerrada':
        if (terminal()) return;
        if (esCierreDefinitivo(mensaje.causa)) {
          estado = 'rechazada';
          registro.error('el orquestador cerró la sala; no se reintenta', { causa: mensaje.causa });
        } else {
          registro.aviso('el orquestador cerró la sala; se vuelve a registrar', { causa: mensaje.causa });
        }
        socket.close(1000);
        return;

      case 'entra-invitado':
        registro.info('llega un invitado', { conexion: mensaje.conexion, canal: mensaje.canal });
        abrirConexionDeDatos({
          base: opciones.url,
          aviso: mensaje,
          manejadores,
          registro,
          abiertas: datosAbiertos,
        });
        return;

      case 'sale-invitado':
        registro.info('el invitado se fue', { conexion: mensaje.conexion });
        return;

      default:
        registro.aviso('mensaje de control inesperado', { tipo: mensaje.tipo });
    }
  }

  function iniciarLatido(socket: WebSocket): void {
    detenerLatido();
    let respondio = true;
    socket.on('pong', () => {
      respondio = true;
    });

    latido = setInterval(() => {
      if (!respondio) {
        registro.aviso('el orquestador no responde; se da la conexión por muerta');
        socket.terminate();
        return;
      }
      respondio = false;
      socket.ping();
      socket.send(serializarControl({ tipo: 'latido' }));
    }, intervaloDeLatido);
  }

  function detenerLatido(): void {
    clearInterval(latido);
    latido = undefined;
  }

  function programarReintento(codigo: number): void {
    estado = 'esperando';
    const milisegundos = espera.siguiente();
    registro.aviso('sin conexión con el orquestador; se reintenta', {
      codigo,
      espera: milisegundos,
      intento: espera.intentos(),
    });
    reintento = setTimeout(() => {
      reintento = undefined;
      if (!terminal()) abrir();
    }, milisegundos);
  }

  abrir();

  function cambiarInvitacion(nuevo: TokenDeInvitacion): Promise<boolean> {
    const socket = control;
    if (estado !== 'registrada' || !socket || cambioPendiente) return Promise.resolve(false);

    return new Promise((resolver) => {
      const rendirse = setTimeout(() => {
        registro.aviso('el orquestador no confirmó el cambio de invitación');
        cambioPendiente?.terminar(false);
      }, ESPERA_DEL_CAMBIO_DE_INVITACION);

      cambioPendiente = {
        nuevo,
        terminar: (ok) => {
          clearTimeout(rendirse);
          cambioPendiente = undefined;
          resolver(ok);
        },
      };
      socket.send(serializarControl({ tipo: 'cambiar-invitacion', tokenDeInvitacion: nuevo }));
    });
  }

  return {
    estado: () => estado,
    invitacionVigente: () => tokenDeInvitacion,
    cambiarInvitacion,
    detener: () =>
      new Promise<void>((listo) => {
        const estabaRegistrada = estado === 'registrada';
        estado = 'detenida';
        clearTimeout(reintento);
        detenerLatido();

        // Los datos se cierran al final: si se cerraran antes de `cerrar-sala`,
        // el invitado vería una caída y no "el host cerró la sala" (B7).
        const terminar = (): void => {
          for (const datos of datosAbiertos) datos.close(1001);
          listo();
        };

        const socket = control;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          socket?.terminate();
          terminar();
          return;
        }

        // Soltar la sala ya, en vez de dejar que caduque por latido.
        if (estabaRegistrada) socket.send(serializarControl({ tipo: 'cerrar-sala' }));

        const rendirse = setTimeout(() => {
          socket.terminate();
          terminar();
        }, ESPERA_DEL_CIERRE);
        socket.once('close', () => {
          clearTimeout(rendirse);
          terminar();
        });
        socket.close(1000);
      }),
  };
}
