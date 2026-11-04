/**
 * Tope de tamaño del protocolo. Fijado en el paso B3, decisión 4, y movido
 * aquí en B7: el orquestador lo aplica al reenviar y el host al recibir, así
 * que es del contrato y no de un solo proceso.
 *
 * 1 MB por mensaje. Los cambios que viajan por un canal son de kilobytes; un
 * megabyte ya es una anomalía y conviene cortarla antes de reenviarla.
 */
export const TAMANO_MAXIMO_DE_MENSAJE = 1024 * 1024;
