/**
 * Límites del túnel. Fijado en el paso B3, decisión 4.
 *
 * Existen porque el orquestador atiende a gente que no controlamos. Sin topes,
 * un invitado que no drena su socket convierte la memoria del orquestador en el
 * límite del sistema, y eso tira **todas** las salas, no solo la suya.
 *
 * El tope de tamaño por mensaje es del protocolo y vive en `@harukoia/domain`.
 */

/**
 * 4 MB en cola por conexión. Si el otro extremo no drena, se le cierra: es
 * preferible un invitado desconectado que un orquestador sin memoria.
 */
export const COLA_MAXIMA_POR_CONEXION = 4 * 1024 * 1024;
