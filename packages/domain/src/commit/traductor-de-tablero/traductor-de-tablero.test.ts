import { describe, expect, it } from 'vitest';

import { FORMATO_DE_TABLERO } from '../formato-de-tablero/formato-de-tablero.ts';
import { exportarTableroAJson, importarTableroDesdeJson } from './traductor-de-tablero.ts';

/** Fixture con N formas como las guarda el mapa `tablero` (H2). */
function fixtureDeRegistros() {
  return {
    'document:doc': {
      id: 'document:doc',
      typeName: 'document',
      name: 'Sala',
      gridSize: 10,
      meta: {},
    },
    'page:inicio': {
      id: 'page:inicio',
      typeName: 'page',
      name: 'Inicio',
      index: 'a0',
      meta: {},
    },
    'shape:rect-1': {
      id: 'shape:rect-1',
      typeName: 'shape',
      type: 'geo',
      x: 40,
      y: 80,
      rotation: 0,
      index: 'a1',
      parentId: 'page:inicio',
      isLocked: false,
      opacity: 1,
      props: { geo: 'rectangle', w: 120, h: 60, color: 'black' },
      meta: {},
    },
    'shape:nota-2': {
      id: 'shape:nota-2',
      typeName: 'shape',
      type: 'note',
      x: 200,
      y: 100,
      rotation: 0.1,
      index: 'a2',
      parentId: 'page:inicio',
      isLocked: false,
      opacity: 0.9,
      props: { color: 'yellow', size: 'm' },
      meta: { etiqueta: 'idea' },
    },
    'asset:img-1': {
      id: 'asset:img-1',
      typeName: 'asset',
      type: 'image',
      props: { src: 'https://ejemplo.test/a.png', w: 64, h: 64 },
      meta: {},
    },
  } as const;
}

describe('traductor de tablero', () => {
  it('exporta → importa sin pérdida observable de lo que el lienzo necesita', () => {
    const originales = fixtureDeRegistros();
    const exportado = exportarTableroAJson(originales);
    expect(exportado.ok).toBe(true);
    if (!exportado.ok) return;

    expect(exportado.tablero.formato).toBe(FORMATO_DE_TABLERO);
    expect(exportado.tablero.formas).toHaveLength(5);
    // Orden estable por id (diffs limpios).
    expect(exportado.tablero.formas.map((f) => f.id)).toEqual([
      'asset:img-1',
      'document:doc',
      'page:inicio',
      'shape:nota-2',
      'shape:rect-1',
    ]);
    // Campos en español / propios, no typeName de tldraw.
    expect(exportado.tablero.formas.some((f) => f.tipo === 'figura')).toBe(true);
    expect(JSON.stringify(exportado.tablero)).not.toContain('typeName');

    const importado = importarTableroDesdeJson(exportado.tablero);
    expect(importado.ok).toBe(true);
    if (!importado.ok) return;

    expect(Object.keys(importado.registros).sort()).toEqual(Object.keys(originales).sort());
    for (const id of Object.keys(originales)) {
      expect(importado.registros[id]).toEqual(originales[id as keyof typeof originales]);
    }
  });

  it('omite registros de sesión (user, camera) al exportar', () => {
    const resultado = exportarTableroAJson({
      ...fixtureDeRegistros(),
      'user:abc': {
        id: 'user:abc',
        typeName: 'user',
        name: 'Ana',
        color: '#000',
        imageUrl: '',
        meta: {},
      },
      'camera:1': { id: 'camera:1', typeName: 'camera', x: 0, y: 0 },
    });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.tablero.formas).toHaveLength(5);
    expect(resultado.tablero.formas.every((f) => !f.id.startsWith('user:'))).toBe(true);
  });

  it('rechaza un typeName desconocido al exportar', () => {
    const resultado = exportarTableroAJson({
      'marco:1': { id: 'marco:1', typeName: 'marco', x: 0, y: 0 },
    });
    expect(resultado).toEqual({
      ok: false,
      causa: 'tipo-de-registro-desconocido',
      id: 'marco:1',
    });
  });

  it('rechaza una forma de tipo desconocido al importar', () => {
    const resultado = importarTableroDesdeJson({
      formato: 1,
      formas: [{ tipo: 'marco', id: 'm1' }],
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.causa).toBe('tipo-desconocido');
  });

  it('rechaza una versión de formato distinta', () => {
    const resultado = importarTableroDesdeJson({ formato: 99, formas: [] });
    expect(resultado).toEqual({ ok: false, causa: 'formato-desconocido' });
  });

  it('el JSON propio se entiende en un diff (coordenadas y orden visibles)', () => {
    const exportado = exportarTableroAJson(fixtureDeRegistros());
    expect(exportado.ok).toBe(true);
    if (!exportado.ok) return;
    const texto = JSON.stringify(exportado.tablero, null, 2);
    expect(texto).toContain('"tipo": "figura"');
    expect(texto).toContain('"x": 40');
    expect(texto).toContain('"y": 80');
    expect(texto).toContain('"figura": "geo"');
  });
});
