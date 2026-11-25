import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ejecutarGit } from '../../git/ejecutar-git.ts';
import { correrStatus } from './status.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('space status (P9)', () => {
  it('fuera de git → error', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'space-status-'));
    temporales.push(dir);
    const r = await correrStatus(dir);
    expect(r.codigo).toBe(1);
    expect(r.texto).toMatch(/No es un repositorio git/);
  });

  it('reporta rama y remoto', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'space-status-ok-'));
    temporales.push(root);
    const bare = path.join(root, 'remoto.git');
    const work = path.join(root, 'work');
    await ejecutarGit(root, ['init', '--bare', bare]);
    await ejecutarGit(root, ['clone', bare, work]);
    await ejecutarGit(work, ['config', 'user.email', 'p9@test']);
    await ejecutarGit(work, ['config', 'user.name', 'P9']);
    fs.writeFileSync(path.join(work, 'README.md'), 'x\n');
    await ejecutarGit(work, ['add', '.']);
    await ejecutarGit(work, ['commit', '-m', 'inicial']);
    const rama = (await ejecutarGit(work, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(work, ['push', '-u', 'origin', rama]);

    const r = await correrStatus(work);
    expect(r.codigo).toBe(0);
    expect(r.texto).toMatch(/Rama:/);
    expect(r.texto).toMatch(/Remoto:/);
    expect(r.texto).toMatch(/al día/);
  });
});
