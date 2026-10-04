import { describe, expect, it } from 'vitest';

import {
  ALFABETO,
  LONGITUD_MINIMA,
  comoIdentificador,
  esIdentificador,
  generarIdentificador,
} from './identificador.ts';

describe('generación de identificadores', () => {
  it('respeta la longitud pedida y el alfabeto', () => {
    for (const longitud of [LONGITUD_MINIMA, 20, 26, 40]) {
      const identificador = generarIdentificador(longitud);

      expect(identificador).toHaveLength(longitud);
      for (const caracter of identificador) {
        expect(ALFABETO).toContain(caracter);
      }
    }
  });

  it('rechaza longitudes por debajo del mínimo', () => {
    expect(() => generarIdentificador(15)).toThrow(RangeError);
    expect(() => generarIdentificador(0)).toThrow(RangeError);
    expect(() => generarIdentificador(16.5)).toThrow(RangeError);
  });

  it('no repite en diez mil generaciones', () => {
    const generados = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      generados.add(generarIdentificador());
    }

    expect(generados.size).toBe(10_000);
  });

  it('usa todo el alfabeto, sin huecos ni sesgo evidente', () => {
    const apariciones = new Map<string, number>();
    const total = 2_000 * LONGITUD_MINIMA;

    for (let i = 0; i < 2_000; i += 1) {
      for (const caracter of generarIdentificador()) {
        apariciones.set(caracter, (apariciones.get(caracter) ?? 0) + 1);
      }
    }

    expect(apariciones.size).toBe(ALFABETO.length);

    // Con reparto uniforme cada símbolo sale total/32 veces. Margen amplio:
    // esto detecta un alfabeto truncado o un generador sesgado, no ruido normal.
    const esperado = total / ALFABETO.length;
    for (const veces of apariciones.values()) {
      expect(veces).toBeGreaterThan(esperado * 0.7);
      expect(veces).toBeLessThan(esperado * 1.3);
    }
  });

  it('no incluye los caracteres que se confunden al leer', () => {
    for (const confuso of ['i', 'l', 'o', 'u']) {
      expect(ALFABETO).not.toContain(confuso);
    }
  });
});

describe('validación de identificadores', () => {
  it('acepta lo que genera', () => {
    expect(esIdentificador(generarIdentificador())).toBe(true);
    expect(esIdentificador(generarIdentificador(26), 26)).toBe(true);
  });

  it('rechaza lo que no es un identificador', () => {
    expect(esIdentificador('corto')).toBe(false);
    expect(esIdentificador('ABCDEFGHJKMNPQRS')).toBe(false); // mayúsculas
    expect(esIdentificador('abcdefghjkmnpqri')).toBe(false); // lleva una i
    expect(esIdentificador('abcdefghjkmnpq-r')).toBe(false); // guion
    expect(esIdentificador(12345678901234567)).toBe(false);
    expect(esIdentificador(null)).toBe(false);
    expect(esIdentificador(undefined)).toBe(false);
  });

  it('rechaza una longitud distinta de la exigida', () => {
    const identificador = generarIdentificador(20);

    expect(esIdentificador(identificador, 26)).toBe(false);
  });
});

describe('conversión de lo que llega de fuera', () => {
  it('devuelve el identificador cuando es válido', () => {
    const original = generarIdentificador();

    expect(comoIdentificador(String(original))).toBe(original);
  });

  it('falla en lugar de dejar pasar basura', () => {
    expect(() => comoIdentificador('../../etc/passwd')).toThrow(TypeError);
    expect(() => comoIdentificador('')).toThrow(TypeError);
  });
});
