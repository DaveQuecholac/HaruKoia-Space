import { generarIdentidadDeSala, type TokenDeInvitacion } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { cambiarInvitacion } from './cambiar-invitacion.ts';

describe('cambiar invitación', () => {
  it('guarda el token nuevo después de que el orquestador confirma', async () => {
    const identidad = generarIdentidadDeSala();
    const guardados: TokenDeInvitacion[] = [];

    const resultado = await cambiarInvitacion(
      identidad,
      async () => true,
      (token) => {
        guardados.push(token);
      },
    )();

    expect(resultado.ok).toBe(true);
    expect(guardados).toHaveLength(1);
    expect(guardados[0]).not.toBe(identidad.tokenDeInvitacion);
    if (resultado.ok) {
      expect(resultado.avisos[0]?.mensaje).toMatchObject({ tokenDeInvitacion: guardados[0] });
    }
  });

  it('si el orquestador no confirma, no guarda', async () => {
    let guardados = 0;

    const resultado = await cambiarInvitacion(
      generarIdentidadDeSala(),
      async () => false,
      () => {
        guardados += 1;
      },
    )();

    expect(resultado).toEqual({ ok: false, causa: 'orquestador-no-disponible' });
    expect(guardados).toBe(0);
  });

  it('si guardar falla, no responde éxito', async () => {
    await expect(
      cambiarInvitacion(
        generarIdentidadDeSala(),
        async () => true,
        () => {
          throw new Error('el keyring no aceptó la identidad');
        },
      )(),
    ).rejects.toThrow(/keyring/);
  });
});