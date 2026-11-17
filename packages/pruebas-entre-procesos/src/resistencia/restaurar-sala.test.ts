/**
 * D3: un host real, matado con SIGKILL, vuelve a publicar la misma sala y el
 * mismo documento. El valor se lee del disco antes de que nadie vuelva a
 * entrar, así el documento local de quien lo escribió no cuenta como prueba.
 */

import { DatabaseSync } from 'node:sqlite';

import * as Y from 'yjs';
import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import { type ProcesoLevantado, apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';

const invitados: InvitadoDeLaSala[] = [];

afterAll(async () => {
  for (const invitado of invitados.splice(0)) invitado.salir();
  await apagarTodos();
});

function entrar(...argumentos: Parameters<typeof invitadoDeLaSala>): InvitadoDeLaSala {
  const invitado = invitadoDeLaSala(...argumentos);
  invitados.push(invitado);
  return invitado;
}

describe('restaurar la sala', () => {
  it(
    'SIGKILL y otro proceso con el mismo disco publican la misma sala y el mismo documento',
    async () => {
      const puerto = await puertoLibre();
      const base = `ws://127.0.0.1:${puerto}`;
      const orquestador = await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
      const host = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: base,
        WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
      });
      const { archivoSqlite, cuentaIdentidad } = discoDelHost(host);
      const { sala, token } = await invitacionDelHost(host);
      await esperarQue(() => registroDeLaSala(orquestador, sala));

      const ana = entrar({ base, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      ana.documento.getMap('prueba').set('trazo', true);
      await esperarQue(() => beto.documento.getMap('prueba').get('trazo') === true);
      await esperarQue(() => leido(archivoSqlite, sala), 15_000);

      const murio = new Promise<void>((listo) => host.proceso.once('exit', () => listo()));
      host.proceso.kill('SIGKILL');
      await murio;
      ana.proveedor.disconnect();
      beto.proveedor.disconnect();
      expect(ana.cierresDeSala).toEqual([]);
      expect(leido(archivoSqlite, sala)).toBe(true);

      const host2 = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: base,
        WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
        SALA_SQLITE: archivoSqlite,
        SALA_IDENTIDAD: cuentaIdentidad,
      });
      const otra = await invitacionDelHost(host2);
      expect(otra.sala).toBe(sala);
      expect(otra.token).toBe(token);
      await esperarQue(() => registroDeLaSala(orquestador, sala));

      const cero = entrar({ base, sala, token, nombre: 'cero' });
      await esperarQue(() => cero.documento.getMap('prueba').get('trazo') === true, 15_000);
      expect(cero.nombresPresentes()).not.toContain('ana');
      expect(cero.nombresPresentes()).not.toContain('beto');
      expect(ana.conectado()).toBe(false);

      await ana.proveedor.connect();
      await esperarQue(() => ana.conectado());
      expect(ana.documento.getMap('prueba').get('trazo')).toBe(true);
      expect(ana.cierresDeSala).toEqual([]);
    },
    60_000,
  );
});

function discoDelHost(host: ProcesoLevantado): { archivoSqlite: string; cuentaIdentidad: string } {
  if (!host.archivoSqlite || !host.cuentaIdentidad) {
    throw new Error('el host de prueba no aisló su disco');
  }
  return { archivoSqlite: host.archivoSqlite, cuentaIdentidad: host.cuentaIdentidad };
}

/** El mapa `prueba` guardado en el SQLite del host, leído sin pasar por el proceso. */
function leido(archivo: string, sala: string): boolean {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(archivo, { readOnly: true });
    const fila = db.prepare('SELECT data FROM documents WHERE name = ?').get(sala) as { data: Uint8Array } | undefined;
    if (!fila) return false;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, fila.data);
    return doc.getMap('prueba').get('trazo') === true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}
