import { describe, expect, it } from 'vitest';

import { naturalezaDelRechazo } from './naturaleza-del-rechazo.ts';

describe('naturaleza del rechazo', () => {
  it('un token que no sirve es definitivo', () => {
    expect(naturalezaDelRechazo('token-de-invitacion-invalido')).toBe('definitivo');
  });

  it('una versión distinta es definitiva', () => {
    expect(naturalezaDelRechazo('mensaje-no-reconocido')).toBe('definitivo');
    expect(naturalezaDelRechazo('canal-no-soportado')).toBe('definitivo');
  });

  it('un host que está volviendo es temporal', () => {
    expect(naturalezaDelRechazo('sala-no-encontrada')).toBe('temporal');
    expect(naturalezaDelRechazo('emparejamiento-expirado')).toBe('temporal');
  });
});
