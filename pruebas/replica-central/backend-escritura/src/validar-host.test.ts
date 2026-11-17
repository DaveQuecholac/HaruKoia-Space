import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { validarHost } from './validar-host.ts';

const esperado = { sala: 'pdc0000000000001', tokenDeHost: 'secreto-de-prueba' };

describe('validarHost', () => {
  it('acepta la sala y el token correctos', () => {
    assert.deepEqual(validarHost({ sala: esperado.sala, tokenDeHost: esperado.tokenDeHost }, esperado), {
      ok: true,
    });
  });

  it('rechaza sin credencial', () => {
    assert.deepEqual(validarHost(null, esperado), { ok: false, causa: 'sin-credencial' });
    assert.deepEqual(validarHost({ sala: esperado.sala }, esperado), {
      ok: false,
      causa: 'sin-credencial',
    });
  });

  it('rechaza token o sala equivocados', () => {
    assert.deepEqual(
      validarHost({ sala: esperado.sala, tokenDeHost: 'otro' }, esperado),
      { ok: false, causa: 'host-no-autorizado' },
    );
    assert.deepEqual(
      validarHost({ sala: 'otra-sala', tokenDeHost: esperado.tokenDeHost }, esperado),
      { ok: false, causa: 'host-no-autorizado' },
    );
  });
});
