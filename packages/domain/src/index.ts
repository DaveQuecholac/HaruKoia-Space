export {
  ALFABETO,
  LONGITUD_MINIMA,
  type Identificador,
  comoIdentificador,
  esIdentificador,
  generarIdentificador,
} from './identificador/identificador.ts';

export {
  LONGITUD_DEL_IDENTIFICADOR,
  LONGITUD_DEL_TOKEN,
  type IdentidadDeSala,
  type IdentificadorDeSala,
  type TokenDeHost,
  type TokenDeInvitacion,
  type TokenDeWebDelHost,
  comoIdentificadorDeSala,
  comoTokenDeHost,
  comoTokenDeInvitacion,
  comoTokenDeWebDelHost,
  generarIdentidadDeSala,
  rotarTokenDeInvitacion,
} from './sala/identidad-de-sala/identidad-de-sala.ts';

export { ROLES, type Rol, esRol } from './sala/rol/rol.ts';

export {
  ACCIONES_DE_SALA,
  CAUSAS_DE_ACCION_RECHAZADA,
  type AccionDeSala,
  type CausaDeAccionRechazada,
  puedePedir,
} from './sala/accion-de-sala/accion-de-sala.ts';

export type {
  MensajeDeSala,
  MensajeDelHostDeLaSala,
  MensajeDelParticipante,
  TipoDeMensajeDeSala,
} from './sala/mensaje-de-sala/mensaje-de-sala.ts';

export {
  type InterpretacionDeSala,
  interpretarMensajeDeSala,
  serializarMensajeDeSala,
} from './sala/mensaje-de-sala/codec-de-sala.ts';

export { CANALES, type Canal, esCanal } from './relay/canal/canal.ts';

export {
  type IdentificadorDeConexion,
  comoIdentificadorDeConexion,
  generarIdentificadorDeConexion,
} from './relay/conexion/conexion.ts';

export { RUTAS, type Ruta, esRutaDelRelay, urlDelRelay } from './relay/rutas/rutas.ts';

export { type Ticket, comoTicket, generarTicket } from './relay/ticket/ticket.ts';

export {
  CAUSAS_DE_CIERRE,
  CAUSAS_DE_RECHAZO,
  TIPOS_DEL_HOST,
  TIPOS_DEL_INVITADO,
  TIPOS_DEL_ORQUESTADOR,
  type CausaDeCierre,
  type CausaDeRechazo,
  type MensajeDeControl,
  type MensajeDelHost,
  type MensajeDelInvitado,
  type MensajeDelOrquestador,
  type TipoDeMensaje,
} from './relay/mensaje-de-control/mensaje-de-control.ts';

export { CODIGO_DE_SALA_CERRADA, causaDelCierreDeSala } from './relay/cierre-de-sala/cierre-de-sala.ts';

export { TAMANO_MAXIMO_DE_MENSAJE } from './relay/limites/limites.ts';

export {
  type Interpretacion,
  interpretarControl,
  serializarControl,
} from './relay/codec-de-control/codec-de-control.ts';
