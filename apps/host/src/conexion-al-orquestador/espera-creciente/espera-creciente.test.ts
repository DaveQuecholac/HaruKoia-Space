import { describe, expect, it } from 'vitest';

import { ESPERA_BASE, ESPERA_TOPE, crearEsperaCreciente } from './espera-creciente.ts';

describe('espera creciente', () => {
  it('con el azar al mínimo, cada espera es el doble de la anterior', () => {
    const espera = crearEsperaCreciente({ base: 1_000, tope: 100_000, azar: () => 0 });

    expect([espera.siguiente(), espera.siguiente(), espera.siguiente()]).toEqual([500, 1_000, 2_000]);
  });

  it('nunca pasa del tope, ni con el azar al máximo', () => {
    const espera = crearEsperaCreciente({ azar: () => 0.999_999 });

    for (let i = 0; i < 60; i += 1) {
      expect(espera.siguiente()).toBeLessThanOrEqual(ESPERA_TOPE);
    }
  });

  it('al llegar al tope se queda entre la mitad del tope y el tope', () => {
    const espera = crearEsperaCreciente();
    for (let i = 0; i < 20; i += 1) espera.siguiente();

    for (let i = 0; i < 50; i += 1) {
      const valor = espera.siguiente();
      expect(valor).toBeGreaterThanOrEqual(ESPERA_TOPE / 2);
      expect(valor).toBeLessThanOrEqual(ESPERA_TOPE);
    }
  });

  it('dos hosts con azar distinto no reintentan en el mismo milisegundo', () => {
    const uno = crearEsperaCreciente({ azar: () => 0.1 });
    const otro = crearEsperaCreciente({ azar: () => 0.9 });

    expect(uno.siguiente()).not.toBe(otro.siguiente());
  });

  it('reiniciar vuelve a la espera base', () => {
    const espera = crearEsperaCreciente({ azar: () => 0 });
    espera.siguiente();
    espera.siguiente();
    espera.siguiente();

    espera.reiniciar();

    expect(espera.intentos()).toBe(0);
    expect(espera.siguiente()).toBe(ESPERA_BASE / 2);
  });
});
