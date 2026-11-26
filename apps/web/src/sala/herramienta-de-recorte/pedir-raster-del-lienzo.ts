/**
 * Pide al lienzo la imagen de una caja, con la exportación que ya trae tldraw.
 * `padding: 0` recorta a esa caja. El arreglo vacío no es un listado que
 * armamos nosotros: la caja es el recorte.
 */

import { Box, type Editor } from 'tldraw';

import type { PedidoDeRaster } from './imagen-de-zona.ts';

export async function pedirRasterDelLienzo(editor: Editor, pedido: PedidoDeRaster): Promise<Blob> {
  const { x, y, w, h } = pedido.caja;
  const { blob } = await editor.toImage([], {
    format: 'png',
    bounds: new Box(x, y, w, h),
    padding: 0,
    background: true,
  });
  return blob;
}
