import {
  type IdentificadorDeSala,
  type TokenDeInvitacion,
  type TokenDeWebDelHost,
  comoIdentificadorDeSala,
  comoTokenDeInvitacion,
  comoTokenDeWebDelHost,
} from '@harukoia/domain';

import type { ProcesoLevantado } from '../levantar-proceso/levantar-proceso.ts';

/** El origen de web que las pruebas le configuran al host en `WEB_ORIGEN`. */
export const ORIGEN_DE_LA_WEB_DE_PRUEBA = 'https://web.prueba.harukoia';

/**
 * Lo que la web de la máquina recibe al pulsar "Volverme host": el mismo
 * `GET /invitacion` que usa la web, con su origen. El host debe haberse
 * levantado con `WEB_ORIGEN = ORIGEN_DE_LA_WEB_DE_PRUEBA`.
 */
export async function invitacionParaLaWeb(host: ProcesoLevantado): Promise<{
  sala: IdentificadorDeSala;
  token: TokenDeInvitacion;
  tokenDeWebDelHost: TokenDeWebDelHost;
}> {
  const respuesta = await fetch(`${host.url}/invitacion`, { headers: { origin: ORIGEN_DE_LA_WEB_DE_PRUEBA } });
  if (!respuesta.ok) throw new Error(`el host no entregó la invitación: ${respuesta.status}`);
  const cuerpo = (await respuesta.json()) as Record<string, unknown>;
  return {
    sala: comoIdentificadorDeSala(cuerpo['sala']),
    token: comoTokenDeInvitacion(cuerpo['tokenDeInvitacion']),
    tokenDeWebDelHost: comoTokenDeWebDelHost(cuerpo['tokenDeWebDelHost']),
  };
}

/** Sala y token de invitación, por el mismo camino que la web. */
export async function invitacionDelHost(host: ProcesoLevantado): Promise<{
  sala: IdentificadorDeSala;
  token: TokenDeInvitacion;
}> {
  const { sala, token } = await invitacionParaLaWeb(host);
  return { sala, token };
}

export function registroDeLaSala(orquestador: ProcesoLevantado, sala: string): boolean {
  return orquestador
    .salida()
    .split('\n')
    .some((linea) => linea.includes(`sala=${sala}`) && linea.includes('sala registrada'));
}
