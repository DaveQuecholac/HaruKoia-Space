import { describe, expect, it } from 'vitest';

import { CODIGO_DE_SALA_CERRADA, causaDelCierreDeSala } from './cierre-de-sala.ts';

describe('cierre de sala', () => {
  it('lee la causa de un cierre de sala', () => {
    expect(causaDelCierreDeSala(CODIGO_DE_SALA_CERRADA, 'host-cerro-la-sala')).toBe('host-cerro-la-sala');
  });

  it('otro código o una razón desconocida no son un cierre de sala', () => {
    expect(causaDelCierreDeSala(1000, 'host-cerro-la-sala')).toBeUndefined();
    expect(causaDelCierreDeSala(1006, '')).toBeUndefined();
    expect(causaDelCierreDeSala(CODIGO_DE_SALA_CERRADA, 'cualquier-cosa')).toBeUndefined();
  });
});
