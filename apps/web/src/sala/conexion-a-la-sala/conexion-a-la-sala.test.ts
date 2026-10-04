/**
 * Qué hace la web cuando algo falla (B7), contra un orquestador falso.
 *
 * El orquestador falso solo habla la entrada de B3: acepta o rechaza, y
 * después cierra cuando la prueba se lo pide. No hay sala Yjs detrás: lo que
 * se mide son los estados, no la sincronización.
 */

import { CODIGO_DE_SALA_CERRADA, generarIdentidadDeSala, generarIdentificadorDeConexion, serializarControl } from '@harukoia/domain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type WebSocket, WebSocketServer } from 'ws';

import { type EstadoDeLaSala, conectarALaSala } from './conexion-a-la-sala.ts';

type Modo = 'aceptar' | 'sala-no-encontrada' | 'token-de-invitacion-invalido';

let servidor: WebSocketServer;
let base: string;
let modo: Modo;
let dentro: WebSocket[];
let intentos: number;
let conexiones: Array<{ salir(): void }>;

beforeEach(async () => {
  modo = 'aceptar';
  dentro = [];
  intentos = 0;
  conexiones = [];
  servidor = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  servidor.on('connection', (socket) => {
    socket.once('message', () => {
      intentos++;
      if (modo === 'aceptar') {
        socket.send(serializarControl({ tipo: 'entrada-aceptada', conexion: generarIdentificadorDeConexion() }));
        dentro.push(socket);
        return;
      }
      socket.send(serializarControl({ tipo: 'entrada-rechazada', causa: modo }));
      socket.close(1008);
    });
  });
  await new Promise<void>((listo) => servidor.once('listening', () => listo()));
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string') throw new Error('sin puerto');
  base = `ws://127.0.0.1:${direccion.port}`;
});

afterEach(async () => {
  for (const conexion of conexiones) conexion.salir();
  await new Promise((listo) => servidor.close(listo));
});

function conectar(esperaMaximaDelHost?: number) {
  const estados: EstadoDeLaSala[] = [];
  const { sala, tokenDeInvitacion } = generarIdentidadDeSala();
  const conexion = conectarALaSala({
    orquestador: base,
    invitacion: { sala, tokenDeInvitacion },
    nombre: 'Prueba',
    rol: 'invitado',
    alCambiar: ({ estado }) => estados.push(estado),
    ...(esperaMaximaDelHost === undefined ? {} : { esperaMaximaDelHost }),
  });
  conexiones.push(conexion);
  return { estados, ultimo: () => estados.at(-1)?.tipo };
}

async function hasta(condicion: () => boolean, limite = 10_000): Promise<void> {
  const fin = Date.now() + limite;
  while (!condicion()) {
    if (Date.now() > fin) throw new Error('la condición no se cumplió a tiempo');
    await new Promise((listo) => setTimeout(listo, 20));
  }
}

function cerrarATodos(codigo: number, razon?: string): void {
  for (const socket of dentro.splice(0)) socket.close(codigo, razon);
}

describe('conexión a la sala ante fallas', () => {
  it('en la primera entrada, "sala no encontrada" se muestra de inmediato', async () => {
    modo = 'sala-no-encontrada';
    const { ultimo, estados } = conectar();

    await hasta(() => ultimo() === 'rechazada');
    expect(estados.at(-1)).toEqual({ tipo: 'rechazada', causa: 'sala-no-encontrada' });
  });

  it('después de estar dentro, "sala no encontrada" espera al host y vuelve sola', async () => {
    const { ultimo } = conectar();
    await hasta(() => ultimo() === 'conectada');

    modo = 'sala-no-encontrada';
    cerrarATodos(1000);
    await hasta(() => ultimo() === 'esperando-al-host');

    modo = 'aceptar';
    await hasta(() => ultimo() === 'conectada', 15_000);
  }, 20_000);

  it('si el host no vuelve a tiempo, la sala se da por cerrada y deja de intentar', async () => {
    const { ultimo } = conectar(1_500);
    await hasta(() => ultimo() === 'conectada');

    modo = 'sala-no-encontrada';
    cerrarATodos(1000);
    await hasta(() => ultimo() === 'sin-host', 5_000);

    const hechos = intentos;
    await new Promise((listo) => setTimeout(listo, 2_500));
    expect(intentos).toBe(hechos);
  }, 15_000);

  it('un rechazo definitivo después de estar dentro detiene', async () => {
    const { ultimo, estados } = conectar();
    await hasta(() => ultimo() === 'conectada');

    modo = 'token-de-invitacion-invalido';
    cerrarATodos(1000);
    await hasta(() => ultimo() === 'rechazada', 15_000);

    expect(estados.at(-1)).toEqual({ tipo: 'rechazada', causa: 'token-de-invitacion-invalido' });
  }, 20_000);

  it('el host cerró la sala: se muestra y no se reintenta', async () => {
    const { ultimo, estados } = conectar();
    await hasta(() => ultimo() === 'conectada');

    const hechos = intentos;
    cerrarATodos(CODIGO_DE_SALA_CERRADA, 'host-cerro-la-sala');
    await hasta(() => ultimo() === 'cerrada');
    await new Promise((listo) => setTimeout(listo, 2_500));

    expect(estados.at(-1)).toEqual({ tipo: 'cerrada', causa: 'host-cerro-la-sala' });
    expect(intentos).toBe(hechos);
  }, 10_000);

  it('una caída cualquiera reconecta sola', async () => {
    const { ultimo, estados } = conectar();
    await hasta(() => ultimo() === 'conectada');

    cerrarATodos(1001);
    await hasta(() => estados.some((e) => e.tipo === 'reconectando'));
    await hasta(() => ultimo() === 'conectada', 15_000);
  }, 20_000);
});
