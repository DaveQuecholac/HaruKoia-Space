import { describe, expect, it } from 'vitest';

import { generarIdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import {
  PREFIJO_PUBLICADO,
  comoRutaPublicada,
  rutasDePublicacionDelCommit,
} from './rutas-publicadas.ts';

describe('rutas publicadas', () => {
  it('arma tablero.json y documento.md bajo el prefijo por commit', () => {
    const commit = generarIdentificadorDeCommit();
    const rutas = rutasDePublicacionDelCommit(commit);
    expect(rutas.directorio).toBe(`${PREFIJO_PUBLICADO}/${commit}`);
    expect(rutas.tableroJson).toBe(`${PREFIJO_PUBLICADO}/${commit}/tablero.json`);
    expect(rutas.documentoMarkdown).toBe(`${PREFIJO_PUBLICADO}/${commit}/documento.md`);
    expect(comoRutaPublicada(rutas.tableroJson).ok).toBe(true);
    expect(comoRutaPublicada(rutas.documentoMarkdown).ok).toBe(true);
  });

  it('acepta el prefijo y rutas hijas', () => {
    expect(comoRutaPublicada(PREFIJO_PUBLICADO)).toEqual({ ok: true, relativa: PREFIJO_PUBLICADO });
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/x/y.md`).ok).toBe(true);
  });

  it('rechaza fuera del prefijo, absolutas y traversal', () => {
    expect(comoRutaPublicada('docs/manual.md').ok).toBe(false);
    expect(comoRutaPublicada('/harukoia/publicado/x').ok).toBe(false);
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/../secreto`).ok).toBe(false);
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/./x`).ok).toBe(false);
    expect(comoRutaPublicada('').ok).toBe(false);
  });
});
