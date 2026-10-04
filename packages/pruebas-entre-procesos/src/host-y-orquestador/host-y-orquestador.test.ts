/**
 * Verificación del paso B4 con los dos procesos reales: el host se registra
 * solo, sobrevive a que el orquestador se caiga, y marca hacia fuera cuando
 * llega un invitado.
 */

import {
  type IdentificadorDeSala,
  type MensajeDeControl,
  type TokenDeInvitacion,
  RUTAS,
  comoIdentificadorDeSala,
  comoTokenDeInvitacion,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import { afterAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import {
  type ProcesoLevantado,
  apagar,
  apagarTodos,
  esperarQue,
  levantar,
  puertoLibre,
} from '../levantar-proceso/levantar-proceso.ts';

afterAll(apagarTodos);

/** Lo que el host imprime al arrancar, solo en desarrollo (decisión de B4). */
function invitacionDelHost(host: ProcesoLevantado): {
  sala: IdentificadorDeSala;
  token: TokenDeInvitacion;
} {
  const sala = /sala=(\w+)/.exec(host.salida())?.[1];
  const token = /tokenDeInvitacion=(\w+)/.exec(host.salida())?.[1];
  if (!sala || !token) throw new Error(`el host no imprimió su invitación:\n${host.salida()}`);
  return { sala: comoIdentificadorDeSala(sala), token: comoTokenDeInvitacion(token) };
}

function registroDeLaSala(orquestador: ProcesoLevantado, sala: string): boolean {
  return orquestador.salida().split('\n').some((linea) => linea.includes(`sala=${sala}`) && linea.includes('sala registrada'));
}

function primerControl(socket: WebSocket): Promise<MensajeDeControl> {
  return new Promise((resolver, rechazar) => {
    socket.once('message', (bytes: Buffer) => {
      const leido = interpretarControl(bytes.toString('utf8'));
      if (leido.ok) resolver(leido.mensaje);
      else rechazar(new Error(leido.detalle));
    });
  });
}

describe('el host frente al orquestador real', () => {
  it(
    'arranca antes que el orquestador, se registra, atiende a un invitado y sobrevive a un reinicio',
    async () => {
      const puerto = await puertoLibre();
      const base = `ws://127.0.0.1:${puerto}`;

      // 1. El host primero: el orquestador todavía no existe.
      const host = await levantar('apps/host/src/main.ts', { ORQUESTADOR_URL: base });
      const { sala, token } = invitacionDelHost(host);
      await esperarQue(() => host.salida().includes('se reintenta'));

      // 2. Aparece el orquestador y el host se registra sin que nadie lo toque.
      const primero = await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
      await esperarQue(() => registroDeLaSala(primero, sala));

      // 3. Un invitado entra: aceptarlo exige que el host haya abierto su
      //    conexión de datos hacia fuera con el ticket.
      const invitado = new WebSocket(`${base}${RUTAS.invitado}`);
      await new Promise((listo) => invitado.once('open', listo));
      const respuesta = primerControl(invitado);
      invitado.send(serializarControl({ tipo: 'entrar', sala, tokenDeInvitacion: token }));
      expect((await respuesta).tipo).toBe('entrada-aceptada');
      await esperarQue(() => host.salida().includes('invitado conectado'));
      invitado.close();

      // 4. El orquestador muere y vuelve en el mismo puerto: la sala reaparece.
      await apagar(primero.proceso);
      const segundo = await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
      await esperarQue(() => registroDeLaSala(segundo, sala));

      // El host nunca terminó.
      expect(host.proceso.exitCode).toBeNull();
    },
    60_000,
  );
});
