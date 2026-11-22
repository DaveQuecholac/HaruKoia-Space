import { describe, expect, it } from 'vitest';

import { ALFABETO, LONGITUD_MINIMA, type Identificador } from '../../identificador/identificador.ts';
import {
  LONGITUD_DEL_COMMIT,
  comoIdentificadorDeCommit,
  generarIdentificadorDeCommit,
} from './identificador-de-commit.ts';

describe('identificador de commit', () => {
  it('genera con la longitud mínima y el alfabeto del motor', () => {
    const id = generarIdentificadorDeCommit();
    expect(id).toHaveLength(LONGITUD_DEL_COMMIT);
    expect(LONGITUD_DEL_COMMIT).toBe(LONGITUD_MINIMA);
    for (const caracter of id) {
      expect(ALFABETO).toContain(caracter);
    }
  });

  it('acepta una cadena válida tipada como commit', () => {
    const crudo = generarIdentificadorDeCommit();
    expect(comoIdentificadorDeCommit(crudo)).toBe(crudo);
  });

  it('rechaza cadenas inválidas', () => {
    expect(() => comoIdentificadorDeCommit('corto')).toThrow(TypeError);
    expect(() => comoIdentificadorDeCommit('iiiiiiiiiiiiiiii')).toThrow(TypeError);
  });

  it('Identificador de sala no es asignable a Identificador de commit', () => {
    const sala = 'abcdefghjkmnpqrs' as Identificador<'sala'>;
    // @ts-expect-error sala no es commit
    const _commit: Identificador<'commit'> = sala;
    void _commit;
    expect(typeof sala).toBe('string');
  });
});
