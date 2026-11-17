/**
 * D9, F10: un segundo proceso con el mismo archivo no publica la sala.
 * El primero sigue sirviendo. Quien solo lee el archivo no entra en este caso.
 */
import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost } from '../invitacion-del-host/invitacion-del-host.ts';
import { type ProcesoLevantado, apagarTodos, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';

afterAll(async () => {
  await apagarTodos();
});

describe('archivo ocupado', () => {
  it('el segundo proceso termina y el primero sigue con la misma sala', async () => {
    const puerto = await puertoLibre();
    const base = `ws://127.0.0.1:${puerto}`;
    await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
    const host = await levantar('apps/host/src/main.ts', {
      ORQUESTADOR_URL: base,
      WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
    });
    const { archivoSqlite, cuentaIdentidad } = discoDelHost(host);
    const { sala } = await invitacionDelHost(host);

    const segundo = levantar('apps/host/src/main.ts', {
      ORQUESTADOR_URL: base,
      WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
      SALA_SQLITE: archivoSqlite,
      SALA_IDENTIDAD: cuentaIdentidad,
    });
    await expect(segundo).rejects.toThrow(/terminó con código 1/);
    await expect(segundo).rejects.toThrow(/database is locked/);
    await expect(segundo).rejects.not.toThrow(/sala registrada/);

    const sigue = await invitacionDelHost(host);
    expect(sigue.sala).toBe(sala);
  }, 30_000);
});

function discoDelHost(host: ProcesoLevantado): { archivoSqlite: string; cuentaIdentidad: string } {
  if (!host.archivoSqlite || !host.cuentaIdentidad) throw new Error('el host de prueba no aisló su disco');
  return { archivoSqlite: host.archivoSqlite, cuentaIdentidad: host.cuentaIdentidad };
}
