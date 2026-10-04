/**
 * Destino de consola: la variante de hoy. En los procesos de servidor la
 * consola termina en los archivos de PM2; en la web, en la consola del
 * navegador. Un destino nuevo es otro módulo que exporte un `Destino`, sin
 * tocar el mecanismo.
 */

import { formatearLinea } from '../formato-de-linea/formato-de-linea.ts';
import type { Destino } from '../registro/registro.ts';

export type Consola = {
  log: (linea: string) => void;
  warn: (linea: string) => void;
  error: (linea: string) => void;
};

/**
 * Los avisos y los errores salen por su canal, para que un error siga siendo
 * un error para PM2 y para el navegador, no solo texto con otra palabra.
 */
export function destinoDeConsola(consola: Consola = console): Destino {
  return (evento) => {
    const linea = formatearLinea(evento);

    if (evento.nivel === 'error') {
      consola.error(linea);
      return;
    }
    if (evento.nivel === 'aviso') {
      consola.warn(linea);
      return;
    }
    consola.log(linea);
  };
}
