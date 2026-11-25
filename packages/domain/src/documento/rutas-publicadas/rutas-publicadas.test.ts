import { describe, expect, it } from 'vitest';

import { generarIdentificadorDeCommit } from '../../commit/identificador-de-commit/identificador-de-commit.ts';
import {
  PREFIJO_PUBLICADO,
  comoRutaPublicada,
  marcaTemporalDeCarpeta,
  nombreDeCarpetaPublicada,
  rutasDePublicacionDelCommit,
  slugParaSegmentoDeRuta,
} from './rutas-publicadas.ts';

describe('rutas publicadas', () => {
  it('arma carpeta legible YYYY-MM-DD_HHMM__autor__mensaje__id8', () => {
    const commit = generarIdentificadorDeCommit();
    // 2026-11-25 13:05 hora local — usamos Date con componentes locales.
    const creadoEn = new Date(2026, 10, 25, 13, 5, 0).getTime();
    const rutas = rutasDePublicacionDelCommit({
      commit,
      creadoEn,
      autor: 'DavePuebasComicas',
      mensaje: 'Prueba comic!',
    });
    const carpeta = nombreDeCarpetaPublicada({
      commit,
      creadoEn,
      autor: 'DavePuebasComicas',
      mensaje: 'Prueba comic!',
    });
    expect(carpeta).toBe(
      `${marcaTemporalDeCarpeta(creadoEn)}__davepuebascomicas__prueba-comic__${String(commit).slice(0, 8)}`,
    );
    expect(rutas.directorio).toBe(`${PREFIJO_PUBLICADO}/${carpeta}`);
    expect(rutas.tableroJson).toBe(`${PREFIJO_PUBLICADO}/${carpeta}/tablero.json`);
    expect(rutas.documentoMarkdown).toBe(`${PREFIJO_PUBLICADO}/${carpeta}/documento.md`);
    expect(comoRutaPublicada(rutas.tableroJson).ok).toBe(true);
  });

  it('slug vacía → x', () => {
    expect(slugParaSegmentoDeRuta('   ', 10)).toBe('x');
    expect(slugParaSegmentoDeRuta('¡¡¡', 10)).toBe('x');
  });

  it('acepta el prefijo y rutas hijas', () => {
    expect(comoRutaPublicada(PREFIJO_PUBLICADO)).toEqual({ ok: true, relativa: PREFIJO_PUBLICADO });
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/x/y.md`).ok).toBe(true);
  });

  it('rechaza fuera del prefijo, absolutas y traversal', () => {
    expect(comoRutaPublicada('docs/manual.md').ok).toBe(false);
    expect(comoRutaPublicada('/Harukoia/Pizarra/x').ok).toBe(false);
    expect(comoRutaPublicada('harukoia/publicado/x').ok).toBe(false);
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/../secreto`).ok).toBe(false);
    expect(comoRutaPublicada(`${PREFIJO_PUBLICADO}/./x`).ok).toBe(false);
    expect(comoRutaPublicada('').ok).toBe(false);
  });
});
