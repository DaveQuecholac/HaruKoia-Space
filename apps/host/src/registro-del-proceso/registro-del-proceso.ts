import { crearRegistro, destinoDeConsola } from '@harukoia/registro';

/** Registro del host. La consola termina en los archivos de PM2. */
export const registro = crearRegistro({
  proceso: 'host',
  destino: destinoDeConsola(),
});
