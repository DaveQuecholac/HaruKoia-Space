import { generarIdentificadorDeCommit } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import {
  comoTrabajoDePublicacion,
  crearTrabajoDePublicacion,
} from './trabajo-de-publicacion.ts';

describe('trabajo de publicación', () => {
  it('crea pendiente con variante por defecto', () => {
    const commit = generarIdentificadorDeCommit();
    const trabajo = crearTrabajoDePublicacion({ commit, creadoEn: 10 });
    expect(trabajo.estado).toBe('pendiente');
    expect(trabajo.variante).toBe('markdown-determinista');
    expect(trabajo.commit).toBe(commit);
    expect(trabajo.intentos).toBe(0);
  });

  it('redondea causa vacía al interpretar', () => {
    const commit = generarIdentificadorDeCommit();
    expect(() =>
      comoTrabajoDePublicacion({
        id: 'pubjob_x',
        commit,
        variante: 'markdown-determinista',
        estado: 'fallido',
        intentos: 1,
        creadoEn: 1,
        actualizadoEn: 2,
        causa: '   ',
      }),
    ).toThrow(/causa/);
  });
});
