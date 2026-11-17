/**
 * D4: SIGTERM sigue siendo un cierre definitivo. El pendiente queda en disco,
 * el mismo link abierto de nuevo ve el documento, y quien ya recibió
 * `host-cerro-la-sala` no vuelve a entrar solo.
 */

import { DatabaseSync } from 'node:sqlite';

import { conectarALaSala, type EstadoDeLaSala } from '../../../../apps/web/src/sala/conexion-a-la-sala/conexion-a-la-sala.ts';
import * as Y from 'yjs';
import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import { type ProcesoLevantado, apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';

const conexiones: Array<{ salir(): void }> = [];
const invitados: InvitadoDeLaSala[] = [];

afterAll(async () => {
  for (const conexion of conexiones.splice(0)) conexion.salir();
  for (const invitado of invitados.splice(0)) invitado.salir();
  await apagarTodos();
});

describe('cierre definitivo', () => {
  it(
    'SIGTERM guarda el pendiente, el mismo link lo ve, y quien recibió el cierre no vuelve solo',
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

      const estados: EstadoDeLaSala[] = [];
      const ana = conectarALaSala({
        orquestador: base,
        invitacion: { sala, tokenDeInvitacion: token },
        nombre: 'ana',
        tokenDeWebDelHost: undefined,
        alCambiar: (instantanea) => estados.push(instantanea.estado),
        alCambiarLaInvitacion: () => {},
      });
      conexiones.push(ana);
      const beto = invitadoDeLaSala({ base, sala, token, nombre: 'beto' });
      invitados.push(beto);
      await esperarQue(() => estados.some((estado) => estado.tipo === 'conectada'));

      ana.documento.getMap('prueba').set('trazo', true);
      await esperarQue(() => beto.documento.getMap('prueba').get('trazo') === true);

      const murio = new Promise<number | null>((listo) => host.proceso.once('exit', (codigo) => listo(codigo)));
      host.proceso.kill('SIGTERM');
      expect(await murio).toBe(0);
      await esperarQue(() => estados.at(-1)?.tipo === 'cerrada');
      expect(estados.at(-1)).toEqual({ tipo: 'cerrada', causa: 'host-cerro-la-sala' });
      expect(host.salida()).toContain('apagando');
      expect(leido(archivoSqlite, sala)).toBe(true);
      beto.salir();

      const host2 = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: base,
        WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
        SALA_SQLITE: archivoSqlite,
        SALA_IDENTIDAD: cuentaIdentidad,
      });
      const otraInvitacion = await invitacionDelHost(host2);
      expect(otraInvitacion.sala).toBe(sala);
      expect(otraInvitacion.token).toBe(token);
      await esperarQue(() => registroDeLaSala(orquestador, sala));

      await new Promise((listo) => setTimeout(listo, 3_000));
      expect(estados.at(-1)).toEqual({ tipo: 'cerrada', causa: 'host-cerro-la-sala' });

      const otra = invitadoDeLaSala({ base, sala, token, nombre: 'otra' });
      invitados.push(otra);
      await esperarQue(() => otra.documento.getMap('prueba').get('trazo') === true, 15_000);
      expect(estados.at(-1)).toEqual({ tipo: 'cerrada', causa: 'host-cerro-la-sala' });
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
