import { describe, expect, it } from 'vitest';

import { ALFABETO, LONGITUD_MINIMA, type Identificador } from '../../identificador/identificador.ts';
import {
  LONGITUD_DEL_DOCUMENTO,
  comoIdentificadorDeDocumento,
  generarIdentificadorDeDocumento,
} from './identificador-de-documento.ts';

describe('identificador de documento', () => {
  it('genera con la longitud mínima y el alfabeto del motor', () => {
    const id = generarIdentificadorDeDocumento();
    expect(id).toHaveLength(LONGITUD_DEL_DOCUMENTO);
    expect(LONGITUD_DEL_DOCUMENTO).toBe(LONGITUD_MINIMA);
    for (const caracter of id) {
      expect(ALFABETO).toContain(caracter);
    }
  });

  it('acepta una cadena válida tipada como documento', () => {
    const crudo = generarIdentificadorDeDocumento();
    expect(comoIdentificadorDeDocumento(crudo)).toBe(crudo);
  });

  it('rechaza cadenas inválidas', () => {
    expect(() => comoIdentificadorDeDocumento('corto')).toThrow(TypeError);
    expect(() => comoIdentificadorDeDocumento('iiiiiiiiiiiiiiii')).toThrow(TypeError);
  });

  it('Identificador de commit no es asignable a Identificador de documento', () => {
    const commit = 'abcdefghjkmnpqrs' as Identificador<'commit'>;
    // @ts-expect-error commit no es documento
    const _documento: Identificador<'documento'> = commit;
    void _documento;
    expect(typeof commit).toBe('string');
  });
});
