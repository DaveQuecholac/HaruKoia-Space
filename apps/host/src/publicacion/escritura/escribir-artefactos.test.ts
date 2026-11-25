import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  crearVinculoSalaRepo,
  generarIdentidadDeSala,
  generarIdentificadorDeCommit,
  rutasDePublicacionDelCommit,
} from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { crearArtefactoDePublicacion } from '../mecanismo/artefacto-de-publicacion.ts';
import { crearProcesadorDesdeRegistro } from '../mecanismo/orquestar-publicacion.ts';
import { crearRegistroDeVariantes } from '../mecanismo/registro-de-variantes.ts';
import { abrirColaDePublicacion } from '../cola-de-publicacion/cola-de-publicacion.ts';
import { crearVarianteMarkdownDeterminista } from '../variantes/markdown-determinista/markdown-determinista.ts';
import {
  crearConsumidorQueEscribe,
  escribirArtefactosEnCheckout,
  resolverRutaDeEscritura,
} from './escribir-artefactos.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function checkoutTemporal(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-p6-'));
  temporales.push(dir);
  return dir;
}

describe('escritura de artefactos (P6)', () => {
  it('escribe dentro del prefijo harukoia/publicado', () => {
    const raiz = checkoutTemporal();
    const commit = generarIdentificadorDeCommit();
    const rutas = rutasDePublicacionDelCommit(commit);
    const md = crearArtefactoDePublicacion(rutas.documentoMarkdown, new TextEncoder().encode('# ok\n'));
    const json = crearArtefactoDePublicacion(
      rutas.tableroJson,
      new TextEncoder().encode('{"formato":1,"formas":[]}\n'),
    );
    expect(md.ok && json.ok).toBe(true);
    if (!md.ok || !json.ok) return;

    const resultado = escribirArtefactosEnCheckout(raiz, [md.artefacto, json.artefacto]);
    expect(resultado.ok).toBe(true);

    expect(fs.readFileSync(path.join(raiz, ...rutas.documentoMarkdown.split('/')), 'utf8')).toBe(
      '# ok\n',
    );
    expect(fs.readFileSync(path.join(raiz, ...rutas.tableroJson.split('/')), 'utf8')).toContain(
      '"formato"',
    );
  });

  it('rechaza ruta fuera del prefijo', () => {
    const raiz = checkoutTemporal();
    const manual = path.join(raiz, 'README.md');
    fs.writeFileSync(manual, 'no tocar\n');

    // Bypass crearArtefacto (que ya valida): fuerza ruta ilegal en el escritor.
    const resultado = escribirArtefactosEnCheckout(raiz, [
      { rutaRelativa: 'docs/manual.md', bytes: new TextEncoder().encode('malo') },
    ]);
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.causa).toBe('ruta-invalida');
    expect(fs.readFileSync(manual, 'utf8')).toBe('no tocar\n');
    expect(fs.existsSync(path.join(raiz, 'docs', 'manual.md'))).toBe(false);
  });

  it('no modifica un archivo manual fuera del árbol publicado', () => {
    const raiz = checkoutTemporal();
    const manual = path.join(raiz, 'docs', 'guia.md');
    fs.mkdirSync(path.dirname(manual), { recursive: true });
    fs.writeFileSync(manual, 'documentacion manual\n');

    const commit = generarIdentificadorDeCommit();
    const rutas = rutasDePublicacionDelCommit(commit);
    const md = crearArtefactoDePublicacion(
      rutas.documentoMarkdown,
      new TextEncoder().encode('# publicado\n'),
    );
    expect(md.ok).toBe(true);
    if (!md.ok) return;

    const resultado = escribirArtefactosEnCheckout(raiz, [md.artefacto]);
    expect(resultado.ok).toBe(true);
    expect(fs.readFileSync(manual, 'utf8')).toBe('documentacion manual\n');
    expect(fs.existsSync(path.join(raiz, ...rutas.documentoMarkdown.split('/')))).toBe(true);
  });

  it('resolverRutaDeEscritura rechaza traversal aunque el string pase mal formado', () => {
    const raiz = checkoutTemporal();
    const intento = resolverRutaDeEscritura(raiz, 'harukoia/publicado/../secrets.txt');
    expect(intento.ok).toBe(false);
  });

  it('consumidor + variante determinista dejan archivos listos para git', async () => {
    const raiz = checkoutTemporal();
    const sala = generarIdentidadDeSala().sala;
    const vinculo = crearVinculoSalaRepo({ sala, raizDelCheckout: raiz });
    expect(vinculo.ok).toBe(true);
    if (!vinculo.ok) return;

    const commit = generarIdentificadorDeCommit();
    const registro = crearRegistroDeVariantes([crearVarianteMarkdownDeterminista()]);
    const procesador = crearProcesadorDesdeRegistro(
      registro,
      async () => ({
        ok: true,
        entrada: {
          commit: {
            id: commit,
            mensaje: 'p6',
            autor: 'Hector',
            participantes: ['Hector'],
            creadoEn: Date.UTC(2026, 10, 25),
          },
          tablero: { formato: 1, formas: [] },
        },
      }),
      crearConsumidorQueEscribe(vinculo.vinculo),
    );

    const cola = abrirColaDePublicacion(path.join(raiz, 'cola.json'));
    cola.encolar(commit, { variante: 'markdown-determinista' });
    const procesado = await cola.procesarSiguiente(procesador);
    expect(procesado.ok).toBe(true);

    const rutas = rutasDePublicacionDelCommit(commit);
    expect(fs.existsSync(path.join(raiz, ...rutas.documentoMarkdown.split('/')))).toBe(true);
    expect(fs.existsSync(path.join(raiz, ...rutas.tableroJson.split('/')))).toBe(true);
    const md = fs.readFileSync(path.join(raiz, ...rutas.documentoMarkdown.split('/')), 'utf8');
    expect(md).toContain('## Versión');
    expect(md).toContain(`id: ${commit}`);
  });
});
