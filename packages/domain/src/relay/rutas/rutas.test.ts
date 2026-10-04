import { describe, expect, it } from 'vitest';

import { RUTAS, urlDelRelay } from './rutas.ts';

describe('urlDelRelay', () => {
  it('pega la ruta a una base sin camino', () => {
    expect(urlDelRelay('wss://orquestador.example', RUTAS.invitado)).toBe('wss://orquestador.example/relay/sala');
  });

  it('conserva el camino de la base, con o sin barra final', () => {
    expect(urlDelRelay('wss://example.com/motor', RUTAS.control)).toBe('wss://example.com/motor/relay/control');
    expect(urlDelRelay('wss://example.com/motor/', RUTAS.datos)).toBe('wss://example.com/motor/relay/datos');
  });
});
