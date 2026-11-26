import { describe, expect, it } from 'vitest';

import { type ManejadoresDeAccion, atenderAccion } from './acciones-de-sala.ts';

function manejadoresContados() {
  let llamadas = 0;
  const manejadores: ManejadoresDeAccion = {
    'cambiar-invitacion': async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
    commitear: async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
    'hacer-checkout': async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
    publicar: async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
    'reintentar-publicacion': async () => {
      llamadas++;
      return { ok: true, avisos: [] };
    },
  };
  return { manejadores, llamadas: () => llamadas };
}

const contexto = { autor: 'Marco', avisar: () => {} };

describe('acciones de sala en el host', () => {
  it('un espectador recibe rol insuficiente y el manejador no corre', async () => {
    const { manejadores, llamadas } = manejadoresContados();

    expect(
      await atenderAccion({ tipo: 'pedir-accion', accion: 'cambiar-invitacion' }, 'espectador', manejadores, contexto),
    ).toEqual({
      ok: false,
      causa: 'rol-insuficiente',
    });
    expect(llamadas()).toBe(0);
  });

  it('el host la ejecuta', async () => {
    const { manejadores, llamadas } = manejadoresContados();

    expect(
      (await atenderAccion({ tipo: 'pedir-accion', accion: 'cambiar-invitacion' }, 'host', manejadores, contexto)).ok,
    ).toBe(true);
    expect(llamadas()).toBe(1);
  });

  it('un espectador no puede commitear', async () => {
    const { manejadores, llamadas } = manejadoresContados();

    expect(
      await atenderAccion(
        { tipo: 'pedir-accion', accion: 'commitear', mensaje: 'x' },
        'espectador',
        manejadores,
        contexto,
      ),
    ).toEqual({ ok: false, causa: 'rol-insuficiente' });
    expect(llamadas()).toBe(0);
  });
});
