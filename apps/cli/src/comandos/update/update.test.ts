import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ejecutarGit } from '../../git/ejecutar-git.ts';
import { correrUpdate, huellaDePublicadosEnDisco } from './update.ts';

const temporales: string[] = [];

afterEach(() => {
  for (const dir of temporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function configurarIdentidad(cwd: string): Promise<void> {
  await ejecutarGit(cwd, ['config', 'user.email', 'p9@test']);
  await ejecutarGit(cwd, ['config', 'user.name', 'P9']);
}

describe('space update (P9)', () => {
  it('en clon limpio tras un push de prueba aparecen markdown + JSON', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'space-update-'));
    temporales.push(root);
    const bare = path.join(root, 'remoto.git');
    const publicador = path.join(root, 'publicador');
    const clon = path.join(root, 'clon');

    await ejecutarGit(root, ['init', '--bare', bare]);
    await ejecutarGit(root, ['clone', bare, publicador]);
    await configurarIdentidad(publicador);

    fs.writeFileSync(path.join(publicador, 'README.md'), 'proyecto\n');
    const dirPub = path.join(publicador, 'harukoia', 'publicado', 'cmtptest123456789');
    fs.mkdirSync(dirPub, { recursive: true });
    fs.writeFileSync(path.join(dirPub, 'documento.md'), '# publicado\n');
    fs.writeFileSync(path.join(dirPub, 'tablero.json'), '{"formato":1,"formas":[]}\n');

    await ejecutarGit(publicador, ['add', '.']);
    await ejecutarGit(publicador, ['commit', '-m', 'harukoia: publicar prueba']);
    const rama = (await ejecutarGit(publicador, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(publicador, ['push', '-u', 'origin', rama]);

    // Clon "quien no estuvo": sin los archivos aún si clonamos antes del push…
    // Aquí clonamos después del push, luego borramos working files y reseteamos
    // para simular quedarse atrás, o clonamos y hacemos update tras un segundo push.
    await ejecutarGit(root, ['clone', bare, clon]);
    await configurarIdentidad(clon);

    // Quitar publicados del working tree y volver un commit atrás no: el clone
    // ya los trae. Segundo push + update es el humo real.
    const dirPub2 = path.join(publicador, 'harukoia', 'publicado', 'cmtbbbbbbbbbbbb');
    fs.mkdirSync(dirPub2, { recursive: true });
    fs.writeFileSync(path.join(dirPub2, 'documento.md'), '# segundo\n');
    fs.writeFileSync(path.join(dirPub2, 'tablero.json'), '{"formato":1,"formas":[]}\n');
    await ejecutarGit(publicador, ['add', '.']);
    await ejecutarGit(publicador, ['commit', '-m', 'harukoia: publicar segundo']);
    await ejecutarGit(publicador, ['push', 'origin', rama]);

    const r = await correrUpdate(clon);
    expect(r.codigo).toBe(0);
    expect(r.texto).toMatch(/Actualizado/);
    expect(
      fs.existsSync(path.join(clon, 'harukoia', 'publicado', 'cmtbbbbbbbbbbbb', 'documento.md')),
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(clon, 'harukoia', 'publicado', 'cmtbbbbbbbbbbbb', 'documento.md'),
        'utf8',
      ),
    ).toBe('# segundo\n');
    expect(
      fs.existsSync(path.join(clon, 'harukoia', 'publicado', 'cmtbbbbbbbbbbbb', 'tablero.json')),
    ).toBe(true);
  });

  it('fuera de un git repo → error claro', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'space-update-nogit-'));
    temporales.push(dir);
    const r = await correrUpdate(dir);
    expect(r.codigo).toBe(1);
    expect(r.texto).toMatch(/No es un repositorio git/);
  });
});

describe('space update idempotencia (P10)', () => {
  it('dos veces seguidas: segundo run sin diff en generados y mensaje de al día', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'space-update-p10-'));
    temporales.push(root);
    const bare = path.join(root, 'remoto.git');
    const publicador = path.join(root, 'publicador');
    const clon = path.join(root, 'clon');

    await ejecutarGit(root, ['init', '--bare', bare]);
    await ejecutarGit(root, ['clone', bare, publicador]);
    await configurarIdentidad(publicador);

    fs.writeFileSync(path.join(publicador, 'README.md'), 'proyecto\n');
    const dirPub = path.join(publicador, 'harukoia', 'publicado', 'cmtcccccccccccc');
    fs.mkdirSync(dirPub, { recursive: true });
    fs.writeFileSync(path.join(dirPub, 'documento.md'), '# idem\n');
    fs.writeFileSync(path.join(dirPub, 'tablero.json'), '{"formato":1,"formas":[]}\n');
    await ejecutarGit(publicador, ['add', '.']);
    await ejecutarGit(publicador, ['commit', '-m', 'harukoia: publicar idem']);
    const rama = (await ejecutarGit(publicador, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(publicador, ['push', '-u', 'origin', rama]);

    await ejecutarGit(root, ['clone', bare, clon]);
    await configurarIdentidad(clon);

    // Clon ya al día tras clone; primer update debe decir al día.
    const primero = await correrUpdate(clon);
    expect(primero.codigo).toBe(0);
    expect(primero.yaAlDia).toBe(true);
    expect(primero.texto).toMatch(/Ya al día/);
    expect(primero.texto).toMatch(/no se reescribieron generados/i);

    const huella1 = primero.huellaDePublicados;
    expect(huella1).toBe(huellaDePublicadosEnDisco(clon));
    expect(fs.readFileSync(path.join(clon, 'harukoia', 'publicado', 'cmtcccccccccccc', 'documento.md'), 'utf8')).toBe(
      '# idem\n',
    );

    const segundo = await correrUpdate(clon);
    expect(segundo.codigo).toBe(0);
    expect(segundo.yaAlDia).toBe(true);
    expect(segundo.texto).toMatch(/Ya al día/);
    expect(segundo.huellaDePublicados).toBe(huella1);
    expect(huellaDePublicadosEnDisco(clon)).toBe(huella1);
  });

  it('tras traer cambios, el siguiente update queda al día sin alterar generados', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'space-update-p10b-'));
    temporales.push(root);
    const bare = path.join(root, 'remoto.git');
    const publicador = path.join(root, 'publicador');
    const clon = path.join(root, 'clon');

    await ejecutarGit(root, ['init', '--bare', bare]);
    await ejecutarGit(root, ['clone', bare, publicador]);
    await configurarIdentidad(publicador);
    fs.writeFileSync(path.join(publicador, 'README.md'), 'base\n');
    await ejecutarGit(publicador, ['add', '.']);
    await ejecutarGit(publicador, ['commit', '-m', 'base']);
    const rama = (await ejecutarGit(publicador, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    await ejecutarGit(publicador, ['push', '-u', 'origin', rama]);

    await ejecutarGit(root, ['clone', bare, clon]);
    await configurarIdentidad(clon);

    const dirPub = path.join(publicador, 'harukoia', 'publicado', 'cmtdddddddddddd');
    fs.mkdirSync(dirPub, { recursive: true });
    fs.writeFileSync(path.join(dirPub, 'documento.md'), '# nuevo\n');
    fs.writeFileSync(path.join(dirPub, 'tablero.json'), '{"formato":1,"formas":[]}\n');
    await ejecutarGit(publicador, ['add', '.']);
    await ejecutarGit(publicador, ['commit', '-m', 'harukoia: publicar nuevo']);
    await ejecutarGit(publicador, ['push', 'origin', rama]);

    const trajo = await correrUpdate(clon);
    expect(trajo.codigo).toBe(0);
    expect(trajo.yaAlDia).toBe(false);
    expect(trajo.texto).toMatch(/Actualizado/);
    const huella = trajo.huellaDePublicados;

    const otraVez = await correrUpdate(clon);
    expect(otraVez.codigo).toBe(0);
    expect(otraVez.yaAlDia).toBe(true);
    expect(otraVez.huellaDePublicados).toBe(huella);
    expect(
      fs.readFileSync(path.join(clon, 'harukoia', 'publicado', 'cmtdddddddddddd', 'documento.md'), 'utf8'),
    ).toBe('# nuevo\n');
  });
});
