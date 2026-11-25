/**
 * CLI `space` (H5 / P9). Solo host / status / update (D-H5-3).
 */

import { TEXTO_DE_AYUDA } from './ayuda/ayuda.ts';
import { correrHost } from './comandos/host/host.ts';
import { correrStatus } from './comandos/status/status.ts';
import { correrUpdate } from './comandos/update/update.ts';

const COMANDOS = new Set(['host', 'status', 'update']);

export async function run(argv: string[]): Promise<number> {
  // pnpm a veces deja un `--` delante: `pnpm space -- status`
  const args = argv[0] === '--' ? argv.slice(1) : argv;
  const comando = args[0];

  if (!comando || comando === '-h' || comando === '--help') {
    process.stdout.write(TEXTO_DE_AYUDA);
    return 0;
  }

  if (!COMANDOS.has(comando)) {
    process.stderr.write(
      `Comando desconocido: ${comando}\nSolo: space host | space status | space update\n`,
    );
    return 1;
  }

  if (comando === 'host') {
    const r = await correrHost();
    if (r.texto) process.stderr.write(r.texto);
    return r.codigo;
  }

  if (comando === 'status') {
    const r = await correrStatus(process.cwd());
    process.stdout.write(r.texto);
    return r.codigo;
  }

  const r = await correrUpdate(process.cwd());
  process.stdout.write(r.texto);
  return r.codigo;
}
