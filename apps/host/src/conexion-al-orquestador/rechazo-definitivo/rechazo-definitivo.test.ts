import { CAUSAS_DE_CIERRE, CAUSAS_DE_RECHAZO } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { esCierreDefinitivo, esRechazoDefinitivo } from './rechazo-definitivo.ts';

describe('rechazos definitivos', () => {
  it('otro dueño de la sala o un token de host malo no se reintentan', () => {
    expect(esRechazoDefinitivo('sala-ocupada-por-otro-host')).toBe(true);
    expect(esRechazoDefinitivo('token-de-host-invalido')).toBe(true);
  });

  it('un contrato que el orquestador no entiende tampoco: reintentar repetiría lo mismo', () => {
    expect(esRechazoDefinitivo('mensaje-mal-formado')).toBe(true);
    expect(esRechazoDefinitivo('mensaje-no-reconocido')).toBe(true);
  });

  it('lo que depende del momento sí se reintenta', () => {
    expect(esRechazoDefinitivo('sala-no-encontrada')).toBe(false);
    expect(esRechazoDefinitivo('emparejamiento-expirado')).toBe(false);
  });

  it('toda causa del contrato tiene una respuesta', () => {
    for (const causa of CAUSAS_DE_RECHAZO) {
      expect(typeof esRechazoDefinitivo(causa)).toBe('boolean');
    }
  });
});

describe('cierres definitivos', () => {
  it('perder el registro por falta de latido se arregla volviendo a registrarse', () => {
    expect(esCierreDefinitivo('host-sin-latido')).toBe(false);
  });

  it('si otra instancia tomó la sala, no se pelea', () => {
    expect(esCierreDefinitivo('host-reemplazado')).toBe(true);
  });

  it('toda causa del contrato tiene una respuesta', () => {
    for (const causa of CAUSAS_DE_CIERRE) {
      expect(typeof esCierreDefinitivo(causa)).toBe('boolean');
    }
  });
});
