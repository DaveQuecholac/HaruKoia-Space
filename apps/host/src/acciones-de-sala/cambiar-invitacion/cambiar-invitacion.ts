/**
 * Acción "cambiar el link de invitación". Fijado en el paso B8, decisión 2.
 *
 * El token nuevo solo vale cuando el orquestador lo confirma: es él quien
 * valida las entradas. Hasta entonces el anterior sigue siendo el vigente, y
 * si no confirma, nada cambió.
 */

import { type IdentidadDeSala, type TokenDeInvitacion, rotarTokenDeInvitacion } from '@harukoia/domain';

import type { ConexionAlOrquestador } from '../../conexion-al-orquestador/conexion-al-orquestador.ts';
import type { ManejadorDeAccion } from '../acciones-de-sala.ts';

export function cambiarInvitacion(
  identidad: IdentidadDeSala,
  pedirAlOrquestador: ConexionAlOrquestador['cambiarInvitacion'],
  guardar: (tokenDeInvitacion: TokenDeInvitacion) => void | Promise<void>,
): ManejadorDeAccion {
  return async () => {
    const { tokenDeInvitacion } = rotarTokenDeInvitacion(identidad);
    const confirmado = await pedirAlOrquestador(tokenDeInvitacion);
    if (!confirmado) return { ok: false, causa: 'orquestador-no-disponible' };
    await guardar(tokenDeInvitacion);
    return { ok: true, avisos: [{ destino: 'hosts', mensaje: { tipo: 'invitacion-cambiada', tokenDeInvitacion } }] };
  };
}
