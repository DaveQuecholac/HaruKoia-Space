/**
 * Almacén local del grafo de commits (V2).
 *
 * Archivo propio (`replica.sqlite`), tablas `commits` y `snapshots`.
 * No toca `sala.sqlite` (F-V6). Sin cola de subida todavía (V6).
 */

import fs from 'node:fs';
import path from 'node:path';

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
import Database from 'better-sqlite3';

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

export type AlmacenDeCommits = {
  readonly archivo: string;
  guardar(datos: DatosParaGuardarCommit): ResultadoDeGuardar;
  listarHistorial(sala: IdentificadorDeSala): readonly Commit[];
  leerSnapshot(id: IdentificadorDeCommit): SnapshotDeCommit | null;
  cerrar(): void;
};

const DDL = `
CREATE TABLE IF NOT EXISTS ${NOMBRE_DE_COLECCION_COMMITS} (
  id TEXT PRIMARY KEY NOT NULL,
  actualizado_en INTEGER NOT NULL,
  borrado INTEGER NOT NULL,
  sala TEXT NOT NULL,
  padre TEXT,
  mensaje TEXT NOT NULL,
  autor TEXT NOT NULL,
  participantes TEXT NOT NULL,
  creado_en INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ${NOMBRE_DE_COLECCION_SNAPSHOTS} (
  id TEXT PRIMARY KEY NOT NULL,
  actualizado_en INTEGER NOT NULL,
  borrado INTEGER NOT NULL,
  estado_yjs_base64 TEXT NOT NULL,
  tablero_json TEXT NOT NULL,
  formato_de_tablero INTEGER NOT NULL
);
`;

export function abrirAlmacenDeCommits(archivo: string): AlmacenDeCommits {
  if (archivo === '' || archivo === ':memory:') {
    throw new Error('el almacén de commits exige un archivo en disco');
  }
  if (path.basename(archivo) === 'sala.sqlite') {
    throw new Error('F-V6: el grafo de commits no puede usar sala.sqlite');
  }

  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new Database(archivo);
  db.exec(DDL);

  const insertarCommit = db.prepare(`
    INSERT INTO ${NOMBRE_DE_COLECCION_COMMITS} (
      id, actualizado_en, borrado, sala, padre, mensaje, autor, participantes, creado_en
    ) VALUES (
      @id, @actualizadoEn, @borrado, @sala, @padre, @mensaje, @autor, @participantes, @creadoEn
    )
  `);

  const insertarSnapshot = db.prepare(`
    INSERT INTO ${NOMBRE_DE_COLECCION_SNAPSHOTS} (
      id, actualizado_en, borrado, estado_yjs_base64, tablero_json, formato_de_tablero
    ) VALUES (
      @id, @actualizadoEn, @borrado, @estadoYjsBase64, @tableroJson, @formatoDeTablero
    )
  `);

  const seleccionarHistorial = db.prepare(`
    SELECT id, actualizado_en AS actualizadoEn, borrado, sala, padre, mensaje, autor,
           participantes, creado_en AS creadoEn
    FROM ${NOMBRE_DE_COLECCION_COMMITS}
    WHERE sala = ? AND borrado = 0
  `);

  const seleccionarSnapshot = db.prepare(`
    SELECT id, actualizado_en AS actualizadoEn, borrado,
           estado_yjs_base64 AS estadoYjsBase64,
           tablero_json AS tableroJson,
           formato_de_tablero AS formatoDeTablero
    FROM ${NOMBRE_DE_COLECCION_SNAPSHOTS}
    WHERE id = ? AND borrado = 0
  `);

  const guardarAmbos = db.transaction(
    (commit: Commit, estadoYjs: Uint8Array, tablero: TableroEnJson, actualizadoEn: number) => {
      insertarCommit.run({
        id: commit.id,
        actualizadoEn,
        borrado: 0,
        sala: commit.sala,
        padre: commit.padre,
        mensaje: commit.mensaje,
        autor: commit.autor,
        participantes: JSON.stringify(commit.participantes),
        creadoEn: commit.creadoEn,
      });
      insertarSnapshot.run({
        id: commit.id,
        actualizadoEn,
        borrado: 0,
        estadoYjsBase64: Buffer.from(estadoYjs).toString('base64'),
        tableroJson: JSON.stringify(tablero),
        formatoDeTablero: tablero.formato,
      });
    },
  );

  return {
    archivo,

    guardar(datos) {
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

      const historial = listarDesdeDb(datos.sala);
      const padreOk = validarPadreDelCommit(historial, creado.commit.padre);
      if (!padreOk.ok) {
        return { ok: false, causa: padreOk.causa };
      }

      const actualizadoEn = Date.now();
      guardarAmbos(creado.commit, datos.estadoYjs, datos.tablero, actualizadoEn);
      return { ok: true, commit: creado.commit };
    },

    listarHistorial(sala) {
      return listarDesdeDb(sala);
    },

    leerSnapshot(id) {
      const fila = seleccionarSnapshot.get(id) as
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

    cerrar() {
      db.close();
    },
  };

  function listarDesdeDb(sala: IdentificadorDeSala): Commit[] {
    const filas = seleccionarHistorial.all(sala) as Array<{
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
      commits.push({
        id: comoIdentificadorDeCommit(interpretada.fila.id),
        sala: comoIdentificadorDeSala(interpretada.fila.sala),
        padre:
          interpretada.fila.padre === null
            ? null
            : comoIdentificadorDeCommit(interpretada.fila.padre),
        mensaje: interpretada.fila.mensaje,
        autor: interpretada.fila.autor,
        participantes: interpretada.fila.participantes,
        creadoEn: interpretada.fila.creadoEn,
      });
    }
    return ordenarHistorial(commits);
  }
}
