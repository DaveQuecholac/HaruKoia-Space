import {
  type IdentificadorDeSala,
  type TokenDeInvitacion,
  comoIdentificadorDeSala,
  comoTokenDeInvitacion,
} from '@harukoia/domain';

import type { ProcesoLevantado } from '../levantar-proceso/levantar-proceso.ts';

/** Lo que el host imprime al arrancar, solo en desarrollo (decisión de B4). */
export function invitacionDelHost(host: ProcesoLevantado): {
  sala: IdentificadorDeSala;
  token: TokenDeInvitacion;
} {
  const sala = /sala=(\w+)/.exec(host.salida())?.[1];
  const token = /tokenDeInvitacion=(\w+)/.exec(host.salida())?.[1];
  if (!sala || !token) throw new Error(`el host no imprimió su invitación:\n${host.salida()}`);
  return { sala: comoIdentificadorDeSala(sala), token: comoTokenDeInvitacion(token) };
}

export function registroDeLaSala(orquestador: ProcesoLevantado, sala: string): boolean {
  return orquestador
    .salida()
    .split('\n')
    .some((linea) => linea.includes(`sala=${sala}`) && linea.includes('sala registrada'));
}
