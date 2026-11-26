import { describe, expect, it } from 'vitest';

import { comoEstadoDePush, esTipoDeEstadoDePush } from './estado-de-push.ts';

describe('estado de push', () => {
  it('acepta solo los tres tipos acordados', () => {
    expect(esTipoDeEstadoDePush('en-proceso')).toBe(true);
    expect(esTipoDeEstadoDePush('publicado')).toBe(true);
    expect(esTipoDeEstadoDePush('fallido')).toBe(true);
    expect(esTipoDeEstadoDePush('reintento')).toBe(false);
    expect(esTipoDeEstadoDePush('abierta')).toBe(false);
  });

  it('interpreta en-proceso, publicado y fallido', () => {
    expect(comoEstadoDePush({ tipo: 'en-proceso' })).toEqual({
      ok: true,
      estado: { tipo: 'en-proceso' },
    });
    expect(comoEstadoDePush({ tipo: 'publicado', publicadoEn: 10 })).toEqual({
      ok: true,
      estado: { tipo: 'publicado', publicadoEn: 10 },
    });
    expect(comoEstadoDePush({ tipo: 'fallido', causa: 'sin remoto', fallidoEn: 20 })).toEqual({
      ok: true,
      estado: { tipo: 'fallido', causa: 'sin remoto', fallidoEn: 20 },
    });
  });

  it('rechaza fallido sin causa y publicado sin marca', () => {
    expect(comoEstadoDePush({ tipo: 'fallido', causa: '  ', fallidoEn: 1 }).ok).toBe(false);
    expect(comoEstadoDePush({ tipo: 'publicado', publicadoEn: -1 }).ok).toBe(false);
  });
});
