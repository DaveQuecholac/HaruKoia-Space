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
  EntradaDeEstadoDePush,
  EntradaDeHistorial,
  MensajeDeSala,
  MensajeDelHostDeLaSala,
  MensajeDelParticipante,
  PedidoDeAccion,
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

export {
  LONGITUD_DEL_COMMIT,
  type IdentificadorDeCommit,
  comoIdentificadorDeCommit,
  generarIdentificadorDeCommit,
} from './commit/identificador-de-commit/identificador-de-commit.ts';

export {
  FORMATO_DE_TABLERO,
  type InterpretacionDeTablero,
  type TableroEnJson,
  interpretarTableroEnJson,
  tableroEnJsonVacio,
} from './commit/formato-de-tablero/formato-de-tablero.ts';

export {
  TIPOS_DE_FORMA,
  type FormaDeTablero,
  type FormaDocumento,
  type FormaFigura,
  type FormaPagina,
  type FormaRecurso,
  type FormaVinculo,
  type InterpretacionDeForma,
  type MetaDeForma,
  type TipoDeForma,
  esTipoDeForma,
  interpretarForma,
} from './commit/forma-de-tablero/forma-de-tablero.ts';

export {
  type RegistroDelTablero,
  type ResultadoDeExportacion,
  type ResultadoDeImportacion,
  TIPOS_DEL_DOCUMENTO_DEL_TABLERO,
  TIPOS_DE_SESION_DEL_LIENZO,
  esRegistroDelDocumentoDelTablero,
  exportarTableroAJson,
  importarTableroDesdeJson,
} from './commit/traductor-de-tablero/traductor-de-tablero.ts';

export {
  type Commit,
  type DatosParaCrearCommit,
  type ResultadoDeCommit,
  comoCommit,
  crearCommit,
} from './commit/commit/commit.ts';

export {
  type ResultadoDePadre,
  ordenarHistorial,
  validarPadreDelCommit,
} from './commit/grafo-de-commits/grafo-de-commits.ts';

export {
  LONGITUD_DEL_DOCUMENTO,
  type IdentificadorDeDocumento,
  comoIdentificadorDeDocumento,
  generarIdentificadorDeDocumento,
} from './documento/identificador-de-documento/identificador-de-documento.ts';

export {
  ESTADOS_DE_PUSH,
  type EstadoDePush,
  type ResultadoDeEstadoDePush,
  type TipoDeEstadoDePush,
  comoEstadoDePush,
  esTipoDeEstadoDePush,
} from './documento/estado-de-push/estado-de-push.ts';

export {
  VARIANTES_DE_PUBLICACION,
  type VarianteDePublicacion,
  esVarianteDePublicacion,
} from './documento/variante-de-publicacion/variante-de-publicacion.ts';

export {
  LONGITUD_SUFIJO_DE_COMMIT,
  NOMBRE_DE_DOCUMENTO_MD,
  NOMBRE_DE_TABLERO_JSON,
  PREFIJO_DOCUMENTOS,
  PREFIJO_PUBLICADO,
  PREFIJO_RAIZ_HARUKOIA,
  type DatosParaRutasDePublicacion,
  type ResultadoDeRutaPublicada,
  type RutasDePublicacion,
  comoRutaPublicada,
  marcaTemporalDeCarpeta,
  nombreDeCarpetaPublicada,
  rutasDePublicacionDelCommit,
  slugParaSegmentoDeRuta,
} from './documento/rutas-publicadas/rutas-publicadas.ts';

export {
  type ResultadoDeVinculo,
  type VinculoSalaRepo,
  comoVinculoSalaRepo,
  crearVinculoSalaRepo,
} from './documento/vinculo-sala-repo/vinculo-sala-repo.ts';

export {
  type DatosParaCrearDocumentoPublicado,
  type DocumentoPublicado,
  type ResultadoDeDocumentoPublicado,
  comoDocumentoPublicado,
  crearDocumentoPublicado,
} from './documento/documento-publicado/documento-publicado.ts';
