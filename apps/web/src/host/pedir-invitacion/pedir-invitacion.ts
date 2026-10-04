/**
 * "Volverme host": pedirle la invitación al host que corre en esta máquina.
 * Fijado en B6. El navegador no arranca el host; si no está corriendo, se
 * dice así en lugar de fallar en silencio.
 */

import { comoIdentificadorDeSala, comoTokenDeInvitacion } from '@harukoia/domain';

import type { Invitacion } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';

export type ResultadoDeLaInvitacion =
  | { readonly ok: true; readonly invitacion: Invitacion }
  | { readonly ok: false; readonly causa: 'host-no-encontrado' | 'host-rechazo' };

export async function pedirInvitacion(urlDelHost: string): Promise<ResultadoDeLaInvitacion> {
  let respuesta: Response;
  try {
    respuesta = await fetch(new URL('/invitacion', urlDelHost), { cache: 'no-store' });
  } catch {
    return { ok: false, causa: 'host-no-encontrado' };
  }
  if (respuesta.status === 404) return { ok: false, causa: 'host-no-encontrado' };
  if (!respuesta.ok) return { ok: false, causa: 'host-rechazo' };

  const cuerpo = (await respuesta.json()) as { sala: string; tokenDeInvitacion: string };
  return {
    ok: true,
    invitacion: {
      sala: comoIdentificadorDeSala(cuerpo.sala),
      tokenDeInvitacion: comoTokenDeInvitacion(cuerpo.tokenDeInvitacion),
    },
  };
}
