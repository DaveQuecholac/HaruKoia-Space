import { describe, expect, it } from 'vitest';

import { puedePedir } from './accion-de-sala.ts';

describe('acciones de sala', () => {
  it('cambiar el link es solo del host', () => {
    expect(puedePedir('host', 'cambiar-invitacion')).toBe(true);
    expect(puedePedir('espectador', 'cambiar-invitacion')).toBe(false);
  });
});
