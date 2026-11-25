/**
 * H5 / P11 — E2E contra remoto git local (H5-T12 / M19).
 *
 * Flujo: host publica (escritura + git) → quien no estuvo hace `space update`
 * → archivos en disco; segunda corrida idempotente; remoto adelantado se resuelve.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generarIdentificadorDeCommit, rutasDePublicacionDelCommit } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { correrUpdate, huellaDePublicadosEnDisco } from '../../../../apps/cli/src/comandos/update/update.ts';
import { escribirArtefactosEnCheckout } from '../../../../apps/host/src/publicacion/escritura/escribir-artefactos.ts';
import { crearArtefactoDePublicacion } from '../../../../apps/host/src/publicacion/mecanismo/artefacto-de-publicacion.ts';
import { ejecutarGit } from '../../../../apps/host/src/publicacion/git/ejecutar-git.ts';
import { publicarEnGit } from '../../../../apps/host/src/publicacion/git/publicar-en-git.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function dirTemporal(prefijo: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefijo));
  temporales.push(dir);
  return dir;
}

async function configurarIdentidad(cwd: string): Promise<void> {
  await ejecutarGit(cwd, ['config', 'user.email', 'p11@harukoia.test']);
  await ejecutarGit(cwd, ['config', 'user.name', 'P11 E2E']);
}

async function bareYPublicador(): Promise<{ bare: string; publicador: string; rama: string }> {
  const root = dirTemporal('harukoia-h5-e2e-');
  const bare = path.join(root, 'remoto.git');
  const publicador = path.join(root, 'publicador');
  await ejecutarGit(root, ['init', '--bare', bare]);
  await ejecutarGit(root, ['clone', bare, publicador]);
  await configurarIdentidad(publicador);
  fs.writeFileSync(path.join(publicador, 'README.md'), 'proyecto\n');
  await ejecutarGit(publicador, ['add', 'README.md']);
  await ejecutarGit(publicador, ['commit', '-m', 'inicial']);
  const rama = (await ejecutarGit(publicador, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  await ejecutarGit(publicador, ['push', '-u', 'origin', rama]);
  return { bare, publicador, rama };
}

async function escribirYPublicar(
  work: string,
  textoMd: string,
): Promise<{ commitId: string; rutas: readonly string[] }> {
  const commitId = generarIdentificadorDeCommit();
  const rutas = rutasDePublicacionDelCommit(commitId);
  const md = crearArtefactoDePublicacion(rutas.documentoMarkdown, new TextEncoder().encode(textoMd));
  const json = crearArtefactoDePublicacion(
    rutas.tableroJson,
    new TextEncoder().encode('{"formato":1,"formas":[]}\n'),
  );
  expect(md.ok && json.ok).toBe(true);
  if (!md.ok || !json.ok) throw new Error('artefactos');
  const escrito = escribirArtefactosEnCheckout(work, [md.artefacto, json.artefacto]);
  expect(escrito.ok).toBe(true);
  const push = await publicarEnGit({
    raizDelCheckout: work,
    rutasRelativas: [rutas.documentoMarkdown, rutas.tableroJson],
    mensaje: `harukoia: publicar ${commitId}`,
  });
  expect(push.ok).toBe(true);
  return { commitId, rutas: [rutas.documentoMarkdown, rutas.tableroJson] };
}

function hashArchivo(ruta: string): string {
  return createHash('sha256').update(fs.readFileSync(ruta)).digest('hex');
}

describe('H5 E2E — publicación + space update (remoto local)', () => {
  it('quien no estuvo: update trae markdown + tablero; ×2 no cambia', async () => {
    const { bare, publicador } = await bareYPublicador();
    const { commitId, rutas } = await escribirYPublicar(publicador, '# e2e h5\n');

    const clon = path.join(path.dirname(publicador), 'quien-no-estuvo');
    await ejecutarGit(path.dirname(publicador), ['clone', bare, clon]);
    await configurarIdentidad(clon);

    // Clone fresco ya trae el tip; simular atraso: reset soft no. Borramos publicados
    // y volvemos un commit atrás, luego update debe recuperarlos.
    for (const r of rutas) {
      const abs = path.join(clon, ...r.split('/'));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
    // Quedarse un commit atrás respecto al tip que tiene la publicación.
    await ejecutarGit(clon, ['reset', '--hard', 'HEAD~1']);
    expect(fs.existsSync(path.join(clon, ...rutas[0]!.split('/')))).toBe(false);

    const primero = await correrUpdate(clon);
    expect(primero.codigo).toBe(0);
    expect(primero.yaAlDia).toBe(false);
    expect(primero.texto).toMatch(/Actualizado/);

    const md = path.join(clon, ...rutas[0]!.split('/'));
    const tablero = path.join(clon, ...rutas[1]!.split('/'));
    expect(fs.readFileSync(md, 'utf8')).toBe('# e2e h5\n');
    expect(fs.readFileSync(tablero, 'utf8')).toBe('{"formato":1,"formas":[]}\n');
    expect(md).toContain(commitId);

    const h1 = huellaDePublicadosEnDisco(clon);
    const hashes = [hashArchivo(md), hashArchivo(tablero)];

    const segundo = await correrUpdate(clon);
    expect(segundo.codigo).toBe(0);
    expect(segundo.yaAlDia).toBe(true);
    expect(segundo.texto).toMatch(/Ya al día/);
    expect(segundo.huellaDePublicados).toBe(h1);
    expect([hashArchivo(md), hashArchivo(tablero)]).toEqual(hashes);
  });

  it('remoto adelantado: publicar reintenta y quien no estuvo recibe el resultado', async () => {
    const { bare, publicador, rama } = await bareYPublicador();
    await escribirYPublicar(publicador, '# A\n');

    const adelantado = path.join(path.dirname(publicador), 'adelantado');
    await ejecutarGit(path.dirname(publicador), ['clone', bare, adelantado]);
    await configurarIdentidad(adelantado);
    fs.appendFileSync(path.join(adelantado, 'README.md'), 'remoto gano\n');
    await ejecutarGit(adelantado, ['add', 'README.md']);
    await ejecutarGit(adelantado, ['commit', '-m', 'remoto adelanta']);
    await ejecutarGit(adelantado, ['push', 'origin', rama]);

    const { rutas } = await escribirYPublicar(publicador, '# B tras adelanto\n');
    // escribirYPublicar ya espera push.ok (incluye reintento interno).

    const clon = path.join(path.dirname(publicador), 'clon-final');
    await ejecutarGit(path.dirname(publicador), ['clone', bare, clon]);
    expect(fs.readFileSync(path.join(clon, 'README.md'), 'utf8')).toContain('remoto gano');
    expect(fs.readFileSync(path.join(clon, ...rutas[0]!.split('/')), 'utf8')).toBe(
      '# B tras adelanto\n',
    );

    const update = await correrUpdate(clon);
    expect(update.codigo).toBe(0);
    expect(update.yaAlDia).toBe(true);
  });
});
