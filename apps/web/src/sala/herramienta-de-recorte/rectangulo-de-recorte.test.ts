import { describe, expect, it } from 'vitest';

import {
  SESION_DE_RECORTE_CERRADA,
  abrirHerramienta,
  cerrarHerramienta,
  enmarcar,
  marcoVisible,
  nombrarDocumento,
  rectanguloDesdeArrastre,
} from './rectangulo-de-recorte.ts';

describe('rectángulo de recorte', () => {
  it('normaliza el arrastre hacia arriba y a la izquierda', () => {
    expect(rectanguloDesdeArrastre({ x: 80, y: 60 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      ancho: 60,
      alto: 50,
    });
  });

  it('un clic sin área no es una zona', () => {
    expect(rectanguloDesdeArrastre({ x: 4, y: 4 }, { x: 4, y: 9 })).toBeNull();
  });

  it('enmarcar deja el nombre en la herramienta', () => {
    const conNombre = nombrarDocumento(abrirHerramienta(SESION_DE_RECORTE_CERRADA), 'junta');
    const enmarcada = enmarcar(conNombre, { x: 1, y: 2, ancho: 30, alto: 40 });
    expect(enmarcada.nombre).toBe('junta');
    expect(enmarcada.rectangulo).toEqual({ x: 1, y: 2, ancho: 30, alto: 40 });
  });

  it('cerrar quita el rectángulo', () => {
    const abierta = enmarcar(nombrarDocumento(abrirHerramienta(SESION_DE_RECORTE_CERRADA), 'junta'), {
      x: 1,
      y: 2,
      ancho: 30,
      alto: 40,
    });
    const cerrada = cerrarHerramienta();
    expect(marcoVisible(abierta)).toBe(true);
    expect(marcoVisible(cerrada)).toBe(false);
    expect(cerrada.rectangulo).toBeNull();
  });
});
