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
  comoIdentificadorDeSala,
  comoTokenDeHost,
  comoTokenDeInvitacion,
  generarIdentidadDeSala,
  rotarTokenDeInvitacion,
} from './sala/identidad-de-sala/identidad-de-sala.ts';

export { CANALES, type Canal, esCanal } from './relay/canal/canal.ts';

export {
  type IdentificadorDeConexion,
  comoIdentificadorDeConexion,
  generarIdentificadorDeConexion,
} from './relay/conexion/conexion.ts';

export { RUTAS, type Ruta, esRutaDelRelay } from './relay/rutas/rutas.ts';

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

export {
  type Interpretacion,
  interpretarControl,
  serializarControl,
} from './relay/codec-de-control/codec-de-control.ts';
