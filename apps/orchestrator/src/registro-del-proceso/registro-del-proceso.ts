import { crearRegistro, destinoDeConsola } from '@harukoia/registro';

/** Registro del orquestador. La consola termina en los archivos de PM2. */
export const registro = crearRegistro({
  proceso: 'orquestador',
  destino: destinoDeConsola(),
});
