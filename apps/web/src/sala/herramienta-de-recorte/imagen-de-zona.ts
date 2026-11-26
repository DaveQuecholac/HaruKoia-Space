/**
 * Raster de la rebanada B. La zona entra como caja en la página.
 * No viaja un listado de formas.
 */

export type PuntoDePagina = {
  readonly x: number;
  readonly y: number;
};

export type CajaDePagina = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
};

export type PedidoDeRaster = {
  readonly caja: CajaDePagina;
};

export function cajaDePagina(origen: PuntoDePagina, opuesto: PuntoDePagina): CajaDePagina | null {
  const w = Math.abs(opuesto.x - origen.x);
  const h = Math.abs(opuesto.y - origen.y);
  if (w === 0 || h === 0) return null;
  return {
    x: Math.min(origen.x, opuesto.x),
    y: Math.min(origen.y, opuesto.y),
    w,
    h,
  };
}

/** El pedido solo lleva la caja. Quien pide la imagen no recibe formas. */
export async function rasterDeLaZona(
  pedir: (pedido: PedidoDeRaster) => Promise<Blob>,
  origen: PuntoDePagina,
  opuesto: PuntoDePagina,
): Promise<Blob | null> {
  const caja = cajaDePagina(origen, opuesto);
  if (!caja) return null;
  return pedir({ caja });
}
