import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ejecutarGit } from '../../git/ejecutar-git.ts';
import { correrHost } from './host.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('space host (P9)', () => {
  it('fuera de un git repo → error claro', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'space-host-nogit-'));
    temporales.push(dir);

    const r = await correrHost({
      cwd: dir,
      arrancar: async () => {
        throw new Error('no debería arrancar');
      },
    });

    expect(r.codigo).toBe(1);
    expect(r.texto).toMatch(/No es un repositorio git/);
    expect(r.texto).toMatch(/D-H5-4/);
  });

  it('en un git repo llama al arranque con ese checkout', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'space-host-git-'));
    temporales.push(dir);
    await ejecutarGit(dir, ['init']);
    await ejecutarGit(dir, ['config', 'user.email', 'p9@test']);
    await ejecutarGit(dir, ['config', 'user.name', 'P9']);

    let visto: { cwd: string; entradaDelHost: string } | undefined;
    const r = await correrHost({
      cwd: dir,
      arrancar: async (opts) => {
        visto = opts;
        return { codigo: 0, texto: 'ok-dry\n' };
      },
    });

    expect(r.codigo).toBe(0);
    expect(visto?.cwd).toBe(dir);
    expect(visto?.entradaDelHost).toMatch(/host[/\\]src[/\\]main\.ts$/);
  });
});
