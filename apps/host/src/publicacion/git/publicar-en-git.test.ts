import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { generarIdentificadorDeCommit, rutasDePublicacionDelCommit } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { escribirArtefactosEnCheckout } from '../escritura/escribir-artefactos.ts';
import { crearArtefactoDePublicacion } from '../mecanismo/artefacto-de-publicacion.ts';
import { ejecutarGit } from './ejecutar-git.ts';
import { publicarEnGit } from './publicar-en-git.ts';

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
  await ejecutarGit(cwd, ['config', 'user.email', 'p7@harukoia.test']);
  await ejecutarGit(cwd, ['config', 'user.name', 'P7 Test']);
}

async function crearBareYClone(): Promise<{ bare: string; work: string }> {
  const root = dirTemporal('harukoia-p7-');
  const bare = path.join(root, 'remoto.git');
  const work = path.join(root, 'work');
  fs.mkdirSync(bare, { recursive: true });
  await ejecutarGit(root, ['init', '--bare', bare]);

  await ejecutarGit(root, ['clone', bare, work]);
  await configurarIdentidad(work);
  // Commit inicial para tener rama main/master con historial.
  fs.writeFileSync(path.join(work, 'README.md'), 'proyecto\n');
  await ejecutarGit(work, ['add', 'README.md']);
  await ejecutarGit(work, ['commit', '-m', 'inicial']);
  const rama = (await ejecutarGit(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
  await ejecutarGit(work, ['push', '-u', 'origin', rama]);
  return { bare, work };
}

async function escribirPublicacion(
  work: string,
  commitId: ReturnType<typeof generarIdentificadorDeCommit>,
  textoMd: string,
): Promise<readonly string[]> {
  const rutas = rutasDePublicacionDelCommit({
    commit: commitId,
    creadoEn: 1_700_000_000_000,
    autor: 'p7',
    mensaje: textoMd.slice(0, 40) || 'pub',
  });
  const md = crearArtefactoDePublicacion(rutas.documentoMarkdown, new TextEncoder().encode(textoMd));
  const json = crearArtefactoDePublicacion(
    rutas.tableroJson,
    new TextEncoder().encode('{"formato":1,"formas":[]}\n'),
  );
  expect(md.ok && json.ok).toBe(true);
  if (!md.ok || !json.ok) return [];
  const escrito = escribirArtefactosEnCheckout(work, [md.artefacto, json.artefacto]);
  expect(escrito.ok).toBe(true);
  return [rutas.documentoMarkdown, rutas.tableroJson];
}

describe('publicar en git (P7)', () => {
  it('remoto bare: push OK y archivos en el remoto', async () => {
    const { bare, work } = await crearBareYClone();
    const commit = generarIdentificadorDeCommit();
    const rutas = await escribirPublicacion(work, commit, '# publicado\n');

    const resultado = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutas,
      mensaje: `harukoia: publicar ${commit}`,
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    // Ver en un clone fresco que el remoto tiene los archivos.
    const otro = path.join(path.dirname(work), 'verificacion');
    await ejecutarGit(path.dirname(work), ['clone', bare, otro]);
    const mdRemoto = path.join(otro, ...rutas[0]!.split('/'));
    expect(fs.existsSync(mdRemoto)).toBe(true);
    expect(fs.readFileSync(mdRemoto, 'utf8')).toBe('# publicado\n');
  });

  it('remoto adelantado: detecta, trae, reintenta y termina publicado', async () => {
    const { bare, work } = await crearBareYClone();
    const commitA = generarIdentificadorDeCommit();
    const rutasA = await escribirPublicacion(work, commitA, '# A\n');
    const primero = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutasA,
      mensaje: `harukoia: publicar ${commitA}`,
    });
    expect(primero.ok).toBe(true);

    // Segundo clone adelanta el remoto con otro commit (README).
    const adelantado = path.join(path.dirname(work), 'adelantado');
    await ejecutarGit(path.dirname(work), ['clone', bare, adelantado]);
    await configurarIdentidad(adelantado);
    fs.appendFileSync(path.join(adelantado, 'README.md'), 'remoto gano\n');
    await ejecutarGit(adelantado, ['add', 'README.md']);
    await ejecutarGit(adelantado, ['commit', '-m', 'remoto adelanta']);
    const rama = (await ejecutarGit(adelantado, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(adelantado, ['push', 'origin', rama]);

    // work local tiene commits propios sin fetch; publica B.
    const commitB = generarIdentificadorDeCommit();
    const rutasB = await escribirPublicacion(work, commitB, '# B gana\n');
    const segundo = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutasB,
      mensaje: `harukoia: publicar ${commitB}`,
    });
    expect(segundo.ok).toBe(true);
    if (!segundo.ok) return;

    const ver = path.join(path.dirname(work), 'ver-adelantado');
    await ejecutarGit(path.dirname(work), ['clone', bare, ver]);
    expect(fs.readFileSync(path.join(ver, 'README.md'), 'utf8')).toContain('remoto gano');
    expect(fs.readFileSync(path.join(ver, ...rutasB[0]!.split('/')), 'utf8')).toBe('# B gana\n');
  });

  it('sin remoto configurado → fallido con causa clara', async () => {
    const root = dirTemporal('harukoia-p7-sinrem-');
    const work = path.join(root, 'work');
    fs.mkdirSync(work);
    await ejecutarGit(work, ['init']);
    await configurarIdentidad(work);
    fs.writeFileSync(path.join(work, 'README.md'), 'x\n');
    await ejecutarGit(work, ['add', 'README.md']);
    await ejecutarGit(work, ['commit', '-m', 'solo local']);

    const commit = generarIdentificadorDeCommit();
    const rutas = await escribirPublicacion(work, commit, '# no\n');
    const resultado = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutas,
      mensaje: 'harukoia: intento',
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.causa).toBe('sin-remoto');
  });

  it('conflicto en generado: gana el generado local del commit nuevo', async () => {
    const { bare, work } = await crearBareYClone();
    const commitId = generarIdentificadorDeCommit();

    // Primera publicación.
    const rutas = await escribirPublicacion(work, commitId, '# local-v1\n');
    const p1 = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutas,
      mensaje: 'harukoia: v1',
    });
    expect(p1.ok).toBe(true);

    // Remoto cambia el mismo generado.
    const otro = path.join(path.dirname(work), 'conflicto');
    await ejecutarGit(path.dirname(work), ['clone', bare, otro]);
    await configurarIdentidad(otro);
    fs.writeFileSync(path.join(otro, ...rutas[0]!.split('/')), '# remoto-v2\n');
    await ejecutarGit(otro, ['add', '--', rutas[0]!]);
    await ejecutarGit(otro, ['commit', '-m', 'remoto cambia generado']);
    const rama = (await ejecutarGit(otro, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(otro, ['push', 'origin', rama]);

    // Local publica versión nueva del mismo path sin haber hecho fetch.
    fs.writeFileSync(path.join(work, ...rutas[0]!.split('/')), '# local-nuevo\n');
    const p2 = await publicarEnGit({
      raizDelCheckout: work,
      rutasRelativas: rutas,
      mensaje: 'harukoia: local-nuevo',
    });
    expect(p2.ok).toBe(true);

    const ver = path.join(path.dirname(work), 'ver-conflicto');
    await ejecutarGit(path.dirname(work), ['clone', bare, ver]);
    expect(fs.readFileSync(path.join(ver, ...rutas[0]!.split('/')), 'utf8')).toBe('# local-nuevo\n');
  });
});

