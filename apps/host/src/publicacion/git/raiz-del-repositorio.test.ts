import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { envSinProxyDeLoopback, ejecutarGit, raizDelRepositorioGit } from './ejecutar-git.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('raizDelRepositorioGit (D-H5-4)', () => {
  it('desde un subdirectorio resuelve el toplevel del repo', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-raiz-git-'));
    temporales.push(root);
    await ejecutarGit(root, ['init']);
    const sub = path.join(root, 'apps', 'host');
    fs.mkdirSync(sub, { recursive: true });

    const raiz = await raizDelRepositorioGit(sub);
    expect(raiz).toBe(await fs.promises.realpath(root));
  });

  it('fuera de git → null', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harukoia-sin-git-'));
    temporales.push(dir);
    expect(await raizDelRepositorioGit(dir)).toBeNull();
  });
});

describe('envSinProxyDeLoopback', () => {
  it('quita proxies a 127.0.0.1 y deja otros', () => {
    const limpio = envSinProxyDeLoopback({
      HTTPS_PROXY: 'http://127.0.0.1:39881',
      HTTP_PROXY: 'http://proxy.corp:8080',
      PATH: '/usr/bin',
    });
    expect(limpio.HTTPS_PROXY).toBeUndefined();
    expect(limpio.HTTP_PROXY).toBe('http://proxy.corp:8080');
    expect(limpio.PATH).toBe('/usr/bin');
  });
});

