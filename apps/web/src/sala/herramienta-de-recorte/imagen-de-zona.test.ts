import { describe, expect, it } from 'vitest';

import { cajaDePagina, rasterDeLaZona, type PedidoDeRaster } from './imagen-de-zona.ts';

describe('imagen de la zona', () => {
  it('arma la caja aunque el arrastre vaya hacia arriba', () => {
    expect(cajaDePagina({ x: 40, y: 30 }, { x: 10, y: 5 })).toEqual({
      x: 10,
      y: 5,
      w: 30,
      h: 25,
    });
  });

  it('pide la imagen solo con la caja', async () => {
    const pedidos: PedidoDeRaster[] = [];
    const blob = await rasterDeLaZona(
      async (pedido) => {
        pedidos.push(pedido);
        return new Blob(['png'], { type: 'image/png' });
      },
      { x: 2, y: 4 },
      { x: 12, y: 9 },
    );
    expect(blob).toBeInstanceOf(Blob);
    expect(pedidos).toEqual([{ caja: { x: 2, y: 4, w: 10, h: 5 } }]);
    expect(Object.keys(pedidos[0] ?? {})).toEqual(['caja']);
  });
});
