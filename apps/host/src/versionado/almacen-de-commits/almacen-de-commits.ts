/**
 * Almacén local del grafo de commits (V2 → V6).
 *
 * Espejo PowerSync (`replica.sqlite` / archivo propio). Tablas `commits` y
 * `snapshots`. No toca `sala.sqlite` (F-V6). Con backend configurado, la cola
 * sube por `uploadData` al backend de escritura.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import {
  type Commit,
  type IdentificadorDeCommit,
  type IdentificadorDeSala,
  type TableroEnJson,
  comoIdentificadorDeCommit,
  comoIdentificadorDeSala,
  crearCommit,
  ordenarHistorial,
  validarPadreDelCommit,
} from '@harukoia/domain';
import {
  NOMBRE_DE_COLECCION_COMMITS,
  NOMBRE_DE_COLECCION_SNAPSHOTS,
  comoFilaDeCommit,
  comoFilaDeSnapshot,
} from '@harukoia/schema';
import { PowerSyncDatabase } from '@powersync/node';

import { esquemaDeReplica } from '../esquema-de-replica/esquema-de-replica.ts';

export type SnapshotDeCommit = {
  readonly commitId: IdentificadorDeCommit;
  readonly estadoYjs: Uint8Array;
  readonly tablero: TableroEnJson;
};

export type DatosParaGuardarCommit = {
  readonly sala: IdentificadorDeSala;
  readonly padre: IdentificadorDeCommit | null;
  readonly mensaje: string;
  readonly autor: string;
  readonly participantes: readonly string[];
  readonly creadoEn: number;
  readonly estadoYjs: Uint8Array;
  readonly tablero: TableroEnJson;
  readonly id?: IdentificadorDeCommit;
};

export type ResultadoDeGuardar =
  | { readonly ok: true; readonly commit: Commit }
  | {
      readonly ok: false;
      readonly causa:
        | 'commit-invalido'
        | 'padre-inexistente'
        | 'raiz-ya-existe'
        | 'tablero-invalido';
    };

export type CredencialDeSubida = {
  readonly backendUrl: string;
  readonly tokenDeHost: string;
  readonly sala: string;
  readonly powersyncUrl?: string;
};

export type AlmacenDeCommits = {
  readonly archivo: string;
  guardar(datos: DatosParaGuardarCommit): Promise<ResultadoDeGuardar>;
  listarHistorial(sala: IdentificadorDeSala): Promise<readonly Commit[]>;
  leerSnapshot(id: IdentificadorDeCommit): Promise<SnapshotDeCommit | null>;
  cerrar(): Promise<void>;
};

const workerPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../powersync.worker.cjs');

export async function abrirAlmacenDeCommits(
  archivo: string,
  subida?: CredencialDeSubida,
): Promise<AlmacenDeCommits> {
  if (archivo === '' || archivo === ':memory:') {
    throw new Error('el almacén de commits exige un archivo en disco');
  }
  if (path.basename(archivo) === 'sala.sqlite') {
    throw new Error('F-V6: el grafo de commits no puede usar sala.sqlite');
  }

  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const dbFilename = path.basename(archivo);
  const dbLocation = path.dirname(archivo);

  const db = new PowerSyncDatabase({
    schema: esquemaDeReplica,
    database: {
      dbFilename,
      dbLocation,
      openWorker: (_factoryPath, options) => new Worker(workerPath, options),
    },
  });

  if (subida) {
    const credencial = subida;
    await db.connect({
      async fetchCredentials() {
        const res = await fetch(
          `${credencial.backendUrl}/sync/bootstrap?sala=${encodeURIComponent(credencial.sala)}`,
        );
        if (!res.ok) throw new Error(`bootstrap ${res.status}`);
        const cuerpo = (await res.json()) as { powersyncUrl: string; token: string };
        return {
          endpoint: cuerpo.powersyncUrl || credencial.powersyncUrl || '',
          token: cuerpo.token,
        };
      },
      async uploadData(database) {
        const tx = await database.getNextCrudTransaction();
        if (!tx) return;

        const batch = tx.crud.map((op) => ({
          op: op.op,
          table: op.table,
          id: op.id,
          data: op.opData,
        }));

        const res = await fetch(`${credencial.backendUrl}/api/data`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${credencial.tokenDeHost}`,
          },
          body: JSON.stringify({ sala: credencial.sala, batch }),
        });

        if (res.status >= 500) {
          throw new Error(`backend temporal ${res.status}: ${await res.text()}`);
        }

        const cuerpo = (await res.json()) as { ok?: boolean; causa?: string };
        if (cuerpo.ok === false) {
          console.warn('subida rechazada', cuerpo.causa);
          await tx.complete();
          return;
        }

        await tx.complete();
      },
    });
  }

  return {
    archivo,

    async guardar(datos) {
      if (
        typeof datos.tablero !== 'object' ||
        datos.tablero === null ||
        !Number.isInteger(datos.tablero.formato) ||
        !Array.isArray(datos.tablero.formas)
      ) {
        return { ok: false, causa: 'tablero-invalido' };
      }

      const creado = crearCommit({
        sala: datos.sala,
        padre: datos.padre,
        mensaje: datos.mensaje,
        autor: datos.autor,
        participantes: datos.participantes,
        creadoEn: datos.creadoEn,
        ...(datos.id !== undefined ? { id: datos.id } : {}),
      });
      if (!creado.ok) {
        return { ok: false, causa: 'commit-invalido' };
      }

      const historial = await listarDesdeDb(datos.sala);
      const padreOk = validarPadreDelCommit(historial, creado.commit.padre);
      if (!padreOk.ok) {
        return { ok: false, causa: padreOk.causa };
      }

      const actualizadoEn = Date.now();
      const participantes = JSON.stringify(creado.commit.participantes);
      const estadoYjsBase64 = Buffer.from(datos.estadoYjs).toString('base64');
      const tableroJson = JSON.stringify(datos.tablero);

      await db.writeTransaction(async (tx) => {
        await tx.execute(
          `INSERT INTO ${NOMBRE_DE_COLECCION_COMMITS} (
             id, actualizado_en, borrado, sala, padre, mensaje, autor, participantes, creado_en
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            creado.commit.id,
            actualizadoEn,
            0,
            creado.commit.sala,
            creado.commit.padre,
            creado.commit.mensaje,
            creado.commit.autor,
            participantes,
            creado.commit.creadoEn,
          ],
        );
        await tx.execute(
          `INSERT INTO ${NOMBRE_DE_COLECCION_SNAPSHOTS} (
             id, actualizado_en, borrado, estado_yjs_base64, tablero_json, formato_de_tablero
           ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            creado.commit.id,
            actualizadoEn,
            0,
            estadoYjsBase64,
            tableroJson,
            datos.tablero.formato,
          ],
        );
      });

      return { ok: true, commit: creado.commit };
    },

    async listarHistorial(sala) {
      return listarDesdeDb(sala);
    },

    async leerSnapshot(id) {
      const filas = await db.getAll(
        `SELECT id, actualizado_en AS actualizadoEn, borrado,
                estado_yjs_base64 AS estadoYjsBase64,
                tablero_json AS tableroJson,
                formato_de_tablero AS formatoDeTablero
         FROM ${NOMBRE_DE_COLECCION_SNAPSHOTS}
         WHERE id = ? AND borrado = 0`,
        [id],
      );
      const fila = filas[0] as
        | {
            id: string;
            actualizadoEn: number;
            borrado: number;
            estadoYjsBase64: string;
            tableroJson: string;
            formatoDeTablero: number;
          }
        | undefined;
      if (!fila) return null;

      const interpretada = comoFilaDeSnapshot({
        ...fila,
        borrado: fila.borrado === 1,
      });
      if (!interpretada.ok) return null;

      let tablero: TableroEnJson;
      try {
        const parseado = JSON.parse(interpretada.fila.tableroJson) as TableroEnJson;
        if (parseado.formato !== interpretada.fila.formatoDeTablero) return null;
        tablero = parseado;
      } catch {
        return null;
      }

      return {
        commitId: comoIdentificadorDeCommit(interpretada.fila.id),
        estadoYjs: Uint8Array.from(Buffer.from(interpretada.fila.estadoYjsBase64, 'base64')),
        tablero,
      };
    },

    async cerrar() {
      try {
        await db.disconnect();
      } catch {
        /* sin conexión */
      }
      await db.close();
    },
  };

  async function listarDesdeDb(sala: IdentificadorDeSala): Promise<Commit[]> {
    const filas = (await db.getAll(
      `SELECT id, actualizado_en AS actualizadoEn, borrado, sala, padre, mensaje, autor,
              participantes, creado_en AS creadoEn
       FROM ${NOMBRE_DE_COLECCION_COMMITS}
       WHERE sala = ? AND borrado = 0`,
      [sala],
    )) as Array<{
      id: string;
      actualizadoEn: number;
      borrado: number;
      sala: string;
      padre: string | null;
      mensaje: string;
      autor: string;
      participantes: string;
      creadoEn: number;
    }>;

    const commits: Commit[] = [];
    for (const fila of filas) {
      let participantes: unknown;
      try {
        participantes = JSON.parse(fila.participantes);
      } catch {
        continue;
      }
      const interpretada = comoFilaDeCommit({
        ...fila,
        borrado: fila.borrado === 1,
        participantes,
      });
      if (!interpretada.ok) continue;
      // Ids basura en la réplica (humo, harness) no deben tumbar el host.
      let id: IdentificadorDeCommit;
      let salaId: IdentificadorDeSala;
      let padre: IdentificadorDeCommit | null;
      try {
        id = comoIdentificadorDeCommit(interpretada.fila.id);
        salaId = comoIdentificadorDeSala(interpretada.fila.sala);
        padre =
          interpretada.fila.padre === null
            ? null
            : comoIdentificadorDeCommit(interpretada.fila.padre);
      } catch {
        continue;
      }
      commits.push({
        id,
        sala: salaId,
        padre,
        mensaje: interpretada.fila.mensaje,
        autor: interpretada.fila.autor,
        participantes: interpretada.fila.participantes,
        creadoEn: interpretada.fila.creadoEn,
      });
    }
    return ordenarHistorial(commits);
  }
}
