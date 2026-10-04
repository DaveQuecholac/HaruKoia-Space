import { afterAll, describe, expect, it } from 'vitest';

import { apagarTodos, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';

afterAll(apagarTodos);

describe('arranque de los procesos del motor', () => {
  it(
    'el orquestador y el host levantan a la vez y responden su estado',
    async () => {
      const orquestador = await levantar('apps/orchestrator/src/main.ts');
      // Desde B4 el host necesita saber a qué orquestador registrarse.
      const host = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: `ws://127.0.0.1:${await puertoLibre()}`,
      });

      expect(orquestador.url).not.toBe(host.url);

      const [estadoDelOrquestador, estadoDelHost] = await Promise.all([
        fetch(`${orquestador.url}/health`).then((r) => r.json()),
        fetch(`${host.url}/health`).then((r) => r.json()),
      ]);

      expect(estadoDelOrquestador).toEqual({ service: 'orchestrator', status: 'ok' });
      expect(estadoDelHost).toEqual({ service: 'host', status: 'ok' });
    },
    30_000,
  );

  it(
    'el host sin ORQUESTADOR_URL se niega a arrancar y dice por qué',
    async () => {
      await expect(levantar('apps/host/src/main.ts', { ORQUESTADOR_URL: '' })).rejects.toThrow(
        /falta ORQUESTADOR_URL/,
      );
    },
    30_000,
  );
});
