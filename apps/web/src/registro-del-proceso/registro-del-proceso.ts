import { crearRegistro, destinoDeConsola } from '@harukoia/registro';

/**
 * Registro de la web. Escribe en la consola del navegador con el mismo formato
 * que los procesos de servidor, para poder comparar las dos puntas de una sala.
 */
export const registro = crearRegistro({
  proceso: 'web',
  destino: destinoDeConsola(),
});
