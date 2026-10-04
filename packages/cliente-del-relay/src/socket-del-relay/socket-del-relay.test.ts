import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import {
  CODIGO_DE_SALA_CERRADA,
  type CausaDeCierre,
  RUTAS,
  generarIdentidadDeSala,
  generarIdentificadorDeConexion,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';

import { CIERRE_POR_RECHAZO, type CausaDeRechazoDeEntrada, claseDelSocketDelRelay } from './socket-del-relay.ts';

const { sala, tokenDeInvitacion } = generarIdentidadDeSala();
const tokenEquivocado = generarIdentidadDeSala().tokenDeInvitacion;

/** Bytes que le piden al orquestador falso cerrar como lo haría el real. */
const CERRAR_LA_SALA = 0xff;
const CORTAR = 0xfe;

const servidores: WebSocketServer[] = [];

afterEach(async () => {
  await Promise.all(servidores.splice(0).map((s) => new Promise((listo) => s.close(listo))));
});

/** Orquestador falso: acepta el token de prueba y después hace eco de bytes. */
async function orquestadorFalso(): Promise<{ base: string; primeros: string[]; rutas: string[] }> {
  const primeros: string[] = [];
  const rutas: string[] = [];
  const servidor = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  servidores.push(servidor);
  servidor.on('connection', (socket, req) => {
    rutas.push(req.url ?? '');
    socket.once('message', (bytes: Buffer) => {
      const texto = bytes.toString('utf8');
      primeros.push(texto);
      const leido = interpretarControl(texto);
      if (leido.ok && leido.mensaje.tipo === 'entrar' && leido.mensaje.tokenDeInvitacion === tokenDeInvitacion) {
        socket.send(serializarControl({ tipo: 'entrada-aceptada', conexion: generarIdentificadorDeConexion() }));
        socket.on('message', (datos: Buffer) => {
          if (datos[0] === CERRAR_LA_SALA) socket.close(CODIGO_DE_SALA_CERRADA, 'host-cerro-la-sala');
          else if (datos[0] === CORTAR) socket.close(1000);
          else socket.send(datos);
        });
        return;
      }
      socket.send(serializarControl({ tipo: 'entrada-rechazada', causa: 'token-de-invitacion-invalido' }));
    });
  });
  await once(servidor, 'listening');
  return { base: `ws://127.0.0.1:${(servidor.address() as AddressInfo).port}`, primeros, rutas };
}

describe('socket del relay', () => {
  it('entra con sala y token en el primer mensaje y solo entonces se declara abierto', async () => {
    const { base, primeros, rutas } = await orquestadorFalso();
    const Clase = claseDelSocketDelRelay({ sala, tokenDeInvitacion });
    const socket = new Clase(base);

    expect(socket.readyState).toBe(0);
    await once(socket, 'open');

    expect(socket.readyState).toBe(1);
    expect(rutas).toEqual([RUTAS.invitado]);
    expect(JSON.parse(primeros[0] ?? '')).toEqual({ tipo: 'entrar', sala, tokenDeInvitacion });
    socket.close();
  });

  it('después de entrar solo pasa bytes, como ArrayBuffer', async () => {
    const { base } = await orquestadorFalso();
    const socket = new (claseDelSocketDelRelay({ sala, tokenDeInvitacion }))(base);
    await once(socket, 'open');

    socket.send(new Uint8Array([1, 2, 3, 250]));
    const [evento] = (await once(socket, 'message')) as [Event & { data: unknown }];

    expect(evento.data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(evento.data as ArrayBuffer)]).toEqual([1, 2, 3, 250]);
    socket.close();
  });

  it('un rechazo se reporta con su causa y nunca abre', async () => {
    const { base } = await orquestadorFalso();
    const causas: CausaDeRechazoDeEntrada[] = [];
    let abrio = false;
    const socket = new (claseDelSocketDelRelay({
      sala,
      tokenDeInvitacion: tokenEquivocado,
      alSerRechazado: (causa) => causas.push(causa),
    }))(base);
    socket.addEventListener('open', () => {
      abrio = true;
    });

    const [cierre] = (await once(socket, 'close')) as [Event & { code: number; reason: string }];

    expect(abrio).toBe(false);
    expect(causas).toEqual(['token-de-invitacion-invalido']);
    expect(cierre.code).toBe(CIERRE_POR_RECHAZO);
    expect(cierre.reason).toBe('token-de-invitacion-invalido');
    expect(socket.readyState).toBe(3);
  });

  it('ya dentro, un cierre de sala se reporta con su causa', async () => {
    const { base } = await orquestadorFalso();
    const causas: CausaDeCierre[] = [];
    const socket = new (claseDelSocketDelRelay({
      sala,
      tokenDeInvitacion,
      alCerrarseLaSala: (causa) => causas.push(causa),
    }))(base);
    await once(socket, 'open');

    socket.send(new Uint8Array([CERRAR_LA_SALA]));
    const [cierre] = (await once(socket, 'close')) as [Event & { code: number }];

    expect(causas).toEqual(['host-cerro-la-sala']);
    expect(cierre.code).toBe(CODIGO_DE_SALA_CERRADA);
  });

  it('un cierre cualquiera no es un cierre de sala', async () => {
    const { base } = await orquestadorFalso();
    const causas: CausaDeCierre[] = [];
    const socket = new (claseDelSocketDelRelay({
      sala,
      tokenDeInvitacion,
      alCerrarseLaSala: (causa) => causas.push(causa),
    }))(base);
    await once(socket, 'open');

    socket.send(new Uint8Array([CORTAR]));
    await once(socket, 'close');

    expect(causas).toEqual([]);
  });

  it('no deja enviar antes de entrar', async () => {
    const { base } = await orquestadorFalso();
    const socket = new (claseDelSocketDelRelay({ sala, tokenDeInvitacion }))(base);

    expect(() => socket.send(new Uint8Array([1]))).toThrow(/todavía no entra/);
    await once(socket, 'open');
    socket.close();
  });
});
