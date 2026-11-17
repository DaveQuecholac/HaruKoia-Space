/**
 * D6: el invitado escribe con el host muerto. Al volver, ese update se fusiona
 * con el documento restaurado del disco. El mapa `tablero` queda con una sola
 * entrada por clave.
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

const FUSIONADO = { antes: 'trazo-en-disco', durante: 'trazo-sin-red' };

describe('fusión sin red', () => {
  it(
    'el update hecho con el host muerto se fusiona con el documento restaurado, sin duplicar la clave',
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
      ana.documento.getMap('tablero').set('antes', FUSIONADO.antes);
      await esperarQue(() => beto.documento.getMap('tablero').get('antes') === FUSIONADO.antes);
      await esperarQue(() => mapa(archivoSqlite, sala)?.antes === FUSIONADO.antes, 15_000);

      const murio = new Promise<void>((listo) => host.proceso.once('exit', () => listo()));
      host.proceso.kill('SIGKILL');
      await murio;

      ana.documento.getMap('tablero').set('durante', FUSIONADO.durante);
      expect(beto.documento.getMap('tablero').get('durante')).toBeUndefined();

      const host2 = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: base,
        WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
        SALA_SQLITE: archivoSqlite,
        SALA_IDENTIDAD: cuentaIdentidad,
      });
      await invitacionDelHost(host2);
      await esperarQue(() => registroDeLaSala(orquestador, sala));

      await esperarQue(() => iguales(ana, beto), 40_000);
      expect(ana.documento.getMap('tablero').toJSON()).toEqual(FUSIONADO);
      expect(beto.documento.getMap('tablero').toJSON()).toEqual(FUSIONADO);

      const cero = entrar({ base, sala, token, nombre: 'cero' });
      await esperarQue(() => iguales(ana, cero), 15_000);
      expect(cero.documento.getMap('tablero').toJSON()).toEqual(FUSIONADO);
      await esperarQue(() => {
        const guardado = mapa(archivoSqlite, sala);
        return guardado?.antes === FUSIONADO.antes && guardado.durante === FUSIONADO.durante;
      }, 15_000);
    },
    60_000,
  );
});

function iguales(a: InvitadoDeLaSala, b: InvitadoDeLaSala): boolean {
  return JSON.stringify(a.documento.getMap('tablero').toJSON()) === JSON.stringify(b.documento.getMap('tablero').toJSON());
}

function discoDelHost(host: ProcesoLevantado): { archivoSqlite: string; cuentaIdentidad: string } {
  if (!host.archivoSqlite || !host.cuentaIdentidad) {
    throw new Error('el host de prueba no aisló su disco');
  }
  return { archivoSqlite: host.archivoSqlite, cuentaIdentidad: host.cuentaIdentidad };
}

function mapa(archivo: string, sala: string): Record<string, unknown> | undefined {
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(archivo, { readOnly: true });
    const fila = db.prepare('SELECT data FROM documents WHERE name = ?').get(sala) as { data: Uint8Array } | undefined;
    if (!fila) return undefined;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, fila.data);
    return doc.getMap('tablero').toJSON() as Record<string, unknown>;
  } catch {
    return undefined;
  } finally {
    db?.close();
  }
}
