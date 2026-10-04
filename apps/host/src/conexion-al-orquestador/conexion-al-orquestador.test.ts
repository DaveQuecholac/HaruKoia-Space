import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import {
  type IdentidadDeSala,
  type MensajeDeControl,
  RUTAS,
  generarIdentidadDeSala,
  generarIdentificadorDeConexion,
  generarTicket,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import { crearRegistro } from '@harukoia/registro';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';

import { type ConexionAlOrquestador, conectarAlOrquestador } from './conexion-al-orquestador.ts';
import type { ConexionDeDatos, ManejadoresDeCanal } from './conexion-de-datos/conexion-de-datos.ts';
import { crearEsperaCreciente } from './espera-creciente/espera-creciente.ts';

/**
 * Un orquestador falso que habla el contrato real. Sirve para probar el host
 * solo: el orquestador verdadero ya tiene sus pruebas, y los dos procesos
 * juntos se prueban en `packages/pruebas-entre-procesos`.
 */
type Recibido = { readonly ruta: string; readonly mensaje: MensajeDeControl; readonly socket: WebSocket };

type Respuesta = (recibido: Recibido) => void;

type OrquestadorFalso = {
  readonly url: string;
  readonly puerto: number;
  readonly recibidos: Recibido[];
  readonly deTipo: (tipo: MensajeDeControl['tipo']) => Recibido[];
  readonly apagar: () => Promise<void>;
};

const aceptarRegistro: Respuesta = ({ mensaje, socket }) => {
  if (mensaje.tipo === 'registrar') {
    socket.send(serializarControl({ tipo: 'registro-aceptado', sala: mensaje.sala }));
  }
};

const encendidos: OrquestadorFalso[] = [];
const conexiones: ConexionAlOrquestador[] = [];

async function orquestadorFalso(
  opciones: { puerto?: number; responder?: Respuesta; autoPong?: boolean } = {},
): Promise<OrquestadorFalso> {
  const responder = opciones.responder ?? aceptarRegistro;
  const servidor: Server = createServer();
  const sockets = new WebSocketServer({ server: servidor, autoPong: opciones.autoPong ?? true });
  const recibidos: Recibido[] = [];

  sockets.on('connection', (socket, peticion) => {
    const ruta = peticion.url ?? '/';
    socket.on('message', (bytes: Buffer, esBinario: boolean) => {
      if (esBinario) return;
      const leido = interpretarControl(bytes.toString('utf8'));
      if (!leido.ok) return;
      const recibido = { ruta, mensaje: leido.mensaje, socket };
      recibidos.push(recibido);
      responder(recibido);
    });
  });

  await new Promise<void>((listo) => servidor.listen(opciones.puerto ?? 0, '127.0.0.1', listo));
  const puerto = (servidor.address() as AddressInfo).port;

  const falso: OrquestadorFalso = {
    url: `ws://127.0.0.1:${puerto}`,
    puerto,
    recibidos,
    deTipo: (tipo) => recibidos.filter((r) => r.mensaje.tipo === tipo),
    apagar: () =>
      new Promise<void>((listo) => {
        for (const cliente of sockets.clients) cliente.terminate();
        sockets.close();
        servidor.close(() => listo());
      }),
  };
  encendidos.push(falso);
  return falso;
}

/** Un puerto libre ahora mismo, para arrancar el host antes que el orquestador. */
async function puertoLibre(): Promise<number> {
  const servidor = createServer();
  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const { port } = servidor.address() as AddressInfo;
  await new Promise<void>((listo) => servidor.close(() => listo()));
  return port;
}

const silencio = crearRegistro({ proceso: 'host', destino: () => {} });

const sinManejo: ManejadoresDeCanal = { sesion: () => {} };

function conectar(
  url: string,
  identidad: IdentidadDeSala,
  extra: { manejadores?: ManejadoresDeCanal; intervaloDeLatido?: number } = {},
): ConexionAlOrquestador {
  const conexion = conectarAlOrquestador({
    url,
    identidad,
    manejadores: extra.manejadores ?? sinManejo,
    registro: silencio,
    espera: crearEsperaCreciente({ base: 20, tope: 80 }),
    ...(extra.intervaloDeLatido === undefined ? {} : { intervaloDeLatido: extra.intervaloDeLatido }),
  });
  conexiones.push(conexion);
  return conexion;
}

async function esperarQue(condicion: () => boolean, limite = 3_000): Promise<void> {
  const inicio = Date.now();
  while (!condicion()) {
    if (Date.now() - inicio > limite) throw new Error('la condición no se cumplió a tiempo');
    await new Promise((listo) => setTimeout(listo, 10));
  }
}

const pausa = (milisegundos: number) => new Promise((listo) => setTimeout(listo, milisegundos));

afterEach(async () => {
  await Promise.all(conexiones.map((conexion) => conexion.detener()));
  conexiones.length = 0;
  await Promise.all(encendidos.map((falso) => falso.apagar()));
  encendidos.length = 0;
});

describe('registro', () => {
  it('se registra con su sala y sus dos tokens al abrir la conexión', async () => {
    const orquestador = await orquestadorFalso();
    const identidad = generarIdentidadDeSala();

    const conexion = conectar(orquestador.url, identidad);

    await esperarQue(() => conexion.estado() === 'registrada');
    const [registro] = orquestador.deTipo('registrar');
    expect(registro?.ruta).toBe(RUTAS.control);
    expect(registro?.mensaje).toEqual({ tipo: 'registrar', ...identidad });
  });

  it('late mientras está registrada', async () => {
    const orquestador = await orquestadorFalso();

    conectar(orquestador.url, generarIdentidadDeSala(), { intervaloDeLatido: 30 });

    await esperarQue(() => orquestador.deTipo('latido').length >= 3);
  });
});

describe('reconexión', () => {
  it('arranca sin orquestador y se registra solo cuando aparece', async () => {
    const puerto = await puertoLibre();
    const conexion = conectar(`ws://127.0.0.1:${puerto}`, generarIdentidadDeSala());

    await pausa(150);
    expect(conexion.estado()).not.toBe('registrada');

    const orquestador = await orquestadorFalso({ puerto });
    await esperarQue(() => conexion.estado() === 'registrada');
    expect(orquestador.deTipo('registrar')).toHaveLength(1);
  });

  it('si el orquestador se cae y vuelve, la misma sala queda registrada otra vez', async () => {
    const primero = await orquestadorFalso();
    const identidad = generarIdentidadDeSala();
    const conexion = conectar(primero.url, identidad);
    await esperarQue(() => conexion.estado() === 'registrada');

    await primero.apagar();
    await esperarQue(() => conexion.estado() !== 'registrada');

    const segundo = await orquestadorFalso({ puerto: primero.puerto });
    await esperarQue(() => conexion.estado() === 'registrada');
    expect(segundo.deTipo('registrar')[0]?.mensaje).toEqual({ tipo: 'registrar', ...identidad });
  });

  it('una conexión que deja de responder en silencio se da por muerta y se rehace', async () => {
    const orquestador = await orquestadorFalso({ autoPong: false });

    const conexion = conectar(orquestador.url, generarIdentidadDeSala(), { intervaloDeLatido: 30 });

    await esperarQue(() => orquestador.deTipo('registrar').length >= 2);
    expect(conexion.estado()).not.toBe('rechazada');
  });
});

describe('rechazos', () => {
  it('un rechazo definitivo no se reintenta', async () => {
    const orquestador = await orquestadorFalso({
      responder: ({ mensaje, socket }) => {
        if (mensaje.tipo !== 'registrar') return;
        socket.send(serializarControl({ tipo: 'registro-rechazado', causa: 'sala-ocupada-por-otro-host' }));
        socket.close(1008);
      },
    });

    const conexion = conectar(orquestador.url, generarIdentidadDeSala());

    await esperarQue(() => conexion.estado() === 'rechazada');
    await pausa(200);
    expect(orquestador.deTipo('registrar')).toHaveLength(1);
  });

  it('un rechazo temporal sí se reintenta', async () => {
    const orquestador = await orquestadorFalso({
      responder: ({ mensaje, socket }) => {
        if (mensaje.tipo !== 'registrar') return;
        socket.send(serializarControl({ tipo: 'registro-rechazado', causa: 'sala-no-encontrada' }));
        socket.close(1008);
      },
    });

    conectar(orquestador.url, generarIdentidadDeSala());

    await esperarQue(() => orquestador.deTipo('registrar').length >= 3);
  });

  it('si el registro caducó por latido, se vuelve a registrar', async () => {
    let cerradas = 0;
    const orquestador = await orquestadorFalso({
      responder: (recibido) => {
        aceptarRegistro(recibido);
        if (recibido.mensaje.tipo === 'registrar' && cerradas === 0) {
          cerradas += 1;
          recibido.socket.send(serializarControl({ tipo: 'sala-cerrada', causa: 'host-sin-latido' }));
          recibido.socket.close(1000);
        }
      },
    });

    const conexion = conectar(orquestador.url, generarIdentidadDeSala());

    await esperarQue(() => orquestador.deTipo('registrar').length === 2);
    await esperarQue(() => conexion.estado() === 'registrada');
  });

  it('si otra instancia tomó la sala, no la pelea', async () => {
    const orquestador = await orquestadorFalso({
      responder: (recibido) => {
        aceptarRegistro(recibido);
        if (recibido.mensaje.tipo === 'registrar') {
          recibido.socket.send(serializarControl({ tipo: 'sala-cerrada', causa: 'host-reemplazado' }));
          recibido.socket.close(1000);
        }
      },
    });

    const conexion = conectar(orquestador.url, generarIdentidadDeSala());

    await esperarQue(() => conexion.estado() === 'rechazada');
    await pausa(200);
    expect(orquestador.deTipo('registrar')).toHaveLength(1);
  });
});

describe('invitados', () => {
  it('ante un invitado abre una conexión de datos saliente con el ticket', async () => {
    const conexionDelInvitado = generarIdentificadorDeConexion();
    const ticket = generarTicket();
    const entregadas: ConexionDeDatos[] = [];
    const recibidosPorElManejador: Buffer[] = [];

    const orquestador = await orquestadorFalso({
      responder: (recibido) => {
        aceptarRegistro(recibido);
        if (recibido.mensaje.tipo === 'registrar') {
          recibido.socket.send(
            serializarControl({ tipo: 'entra-invitado', conexion: conexionDelInvitado, canal: 'sesion', ticket }),
          );
        }
        if (recibido.mensaje.tipo === 'emparejar') {
          recibido.socket.send(
            serializarControl({ tipo: 'emparejamiento-aceptado', conexion: recibido.mensaje.conexion }),
          );
          recibido.socket.send(Buffer.from([1, 2, 3]), { binary: true });
        }
      },
    });

    conectar(orquestador.url, generarIdentidadDeSala(), {
      manejadores: {
        sesion: (datos) => {
          entregadas.push(datos);
          datos.socket.on('message', (bytes: Buffer) => recibidosPorElManejador.push(bytes));
        },
      },
    });

    await esperarQue(() => recibidosPorElManejador.length === 1);
    const [emparejar] = orquestador.deTipo('emparejar');
    expect(emparejar?.ruta).toBe(RUTAS.datos);
    expect(emparejar?.mensaje).toEqual({ tipo: 'emparejar', conexion: conexionDelInvitado, ticket });
    expect(entregadas[0]?.canal).toBe('sesion');
    expect(entregadas[0]?.conexion).toBe(conexionDelInvitado);
    expect([...recibidosPorElManejador[0]!]).toEqual([1, 2, 3]);
  });

  it('si el emparejamiento se rechaza, el manejador no recibe nada', async () => {
    let llamadas = 0;
    const orquestador = await orquestadorFalso({
      responder: (recibido) => {
        aceptarRegistro(recibido);
        if (recibido.mensaje.tipo === 'registrar') {
          recibido.socket.send(
            serializarControl({
              tipo: 'entra-invitado',
              conexion: generarIdentificadorDeConexion(),
              canal: 'sesion',
              ticket: generarTicket(),
            }),
          );
        }
        if (recibido.mensaje.tipo === 'emparejar') {
          recibido.socket.send(serializarControl({ tipo: 'emparejamiento-rechazado', causa: 'ticket-invalido' }));
          recibido.socket.close(1008);
        }
      },
    });

    conectar(orquestador.url, generarIdentidadDeSala(), {
      manejadores: { sesion: () => (llamadas += 1) },
    });

    await esperarQue(() => orquestador.deTipo('emparejar').length === 1);
    await pausa(100);
    expect(llamadas).toBe(0);
  });
});

describe('detener', () => {
  it('suelta la sala en el orquestador y no vuelve a conectar', async () => {
    const orquestador = await orquestadorFalso();
    const conexion = conectar(orquestador.url, generarIdentidadDeSala());
    await esperarQue(() => conexion.estado() === 'registrada');

    await conexion.detener();

    await esperarQue(() => orquestador.deTipo('cerrar-sala').length === 1);
    await pausa(150);
    expect(conexion.estado()).toBe('detenida');
    expect(orquestador.deTipo('registrar')).toHaveLength(1);
  });

  it('detener mientras espera para reintentar cancela el reintento', async () => {
    const puerto = await puertoLibre();
    const conexion = conectar(`ws://127.0.0.1:${puerto}`, generarIdentidadDeSala());
    await esperarQue(() => conexion.estado() === 'esperando');

    await conexion.detener();
    const orquestador = await orquestadorFalso({ puerto });
    await pausa(200);

    expect(orquestador.recibidos).toHaveLength(0);
  });
});
