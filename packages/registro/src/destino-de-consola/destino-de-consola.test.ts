import { describe, expect, it } from 'vitest';

import { crearRegistro } from '../registro/registro.ts';
import { type Consola, destinoDeConsola } from './destino-de-consola.ts';

function consolaDePrueba() {
  const log: string[] = [];
  const warn: string[] = [];
  const error: string[] = [];
  const consola: Consola = {
    log: (linea) => log.push(linea),
    warn: (linea) => warn.push(linea),
    error: (linea) => error.push(linea),
  };

  return { consola, log, warn, error };
}

describe('destino de consola', () => {
  it('manda cada nivel por su canal', () => {
    const { consola, log, warn, error } = consolaDePrueba();
    const registro = crearRegistro({ proceso: 'host', destino: destinoDeConsola(consola) });

    registro.info('uno');
    registro.aviso('dos');
    registro.error('tres');

    expect(log).toHaveLength(1);
    expect(warn).toHaveLength(1);
    expect(error).toHaveLength(1);
  });

  it('escribe la línea ya formateada', () => {
    const { consola, log } = consolaDePrueba();
    const registro = crearRegistro({
      proceso: 'host',
      destino: destinoDeConsola(consola),
      reloj: () => new Date('2026-10-04T09:12:33.481Z'),
    });

    registro.con({ sala: '4k7m' }).info('sala abierta');

    expect(log[0]).toBe('2026-10-04T09:12:33.481Z info  host sala=4k7m sala abierta');
  });
});
