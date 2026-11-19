import { describe, expect, it } from 'vitest';

import { validarHost } from './validar-host.ts';

const esperado = { sala: 'sala001', tokenDeHost: 'secreto-host' };

describe('validarHost', () => {
  it('acepta sala y token correctos', () => {
    expect(validarHost({ sala: 'sala001', tokenDeHost: 'secreto-host' }, esperado)).toEqual({
      ok: true,
    });
  });

  it('rechaza token inventado', () => {
    expect(validarHost({ sala: 'sala001', tokenDeHost: 'otro' }, esperado)).toEqual({
      ok: false,
      causa: 'host-no-autorizado',
    });
  });

  it('rechaza sin credencial', () => {
    expect(validarHost({}, esperado)).toEqual({ ok: false, causa: 'sin-credencial' });
  });
});
