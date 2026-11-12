/**
 * D9, F3: una entrada ilegible en el arranque del proceso no publica otra sala.
 * El proceso termina y el log dice la causa. No aparece «identidad creada».
 */
import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';

import { levantar } from '../levantar-proceso/levantar-proceso.ts';

const require = createRequire(new URL('../../../../apps/host/package.json', import.meta.url));
const { Entry } = require('@napi-rs/keyring') as {
  Entry: new (
    servicio: string,
    cuenta: string,
    opciones: { linux: { store: 'secret-service' } },
  ) => { setPassword(valor: string): void; deletePassword(): void };
};

const SERVICIO = 'iokoia.harukoia';
const cuentas: string[] = [];

afterAll(() => {
  for (const cuenta of cuentas.splice(0)) {
    try {
      new Entry(SERVICIO, cuenta, { linux: { store: 'secret-service' } }).deletePassword();
    } catch {
      // La entrada ya no está.
    }
  }
});

describe('almacén ilegible', () => {
  it('el proceso no arranca y no crea otra identidad', async () => {
    const cuenta = `prueba-ilegible-${process.pid}-${Date.now()}`;
    cuentas.push(cuenta);
    new Entry(SERVICIO, cuenta, { linux: { store: 'secret-service' } }).setPassword('{}');

    const fallo = levantar('apps/host/src/main.ts', {
      ORQUESTADOR_URL: 'wss://orquestador.invalido',
      SALA_IDENTIDAD: cuenta,
    });
    await expect(fallo).rejects.toThrow(/terminó con código 1/);
    await expect(fallo).rejects.toThrow(/no se pudo leer la identidad de la sala/);
    await expect(fallo).rejects.not.toThrow(/identidad de la sala creada/);
  });
});
