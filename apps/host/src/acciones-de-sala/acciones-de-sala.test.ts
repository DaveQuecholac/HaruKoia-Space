import { describe, expect, it } from 'vitest';

import { type ManejadoresDeAccion, atenderAccion } from './acciones-de-sala.ts';

function manejadoresContados() {
  let llamadas = 0;
  const manejadores: ManejadoresDeAccion = {
    'cambiar-invitacion': async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
  };
  return { manejadores, llamadas: () => llamadas };
}

describe('acciones de sala en el host', () => {
  it('un espectador recibe rol insuficiente y el manejador no corre', async () => {
    const { manejadores, llamadas } = manejadoresContados();

    expect(await atenderAccion('cambiar-invitacion', 'espectador', manejadores)).toEqual({
      ok: false,
      causa: 'rol-insuficiente',
    });
    expect(llamadas()).toBe(0);
  });

  it('el host la ejecuta', async () => {
    const { manejadores, llamadas } = manejadoresContados();

    expect((await atenderAccion('cambiar-invitacion', 'host', manejadores)).ok).toBe(true);
    expect(llamadas()).toBe(1);
  });
});
