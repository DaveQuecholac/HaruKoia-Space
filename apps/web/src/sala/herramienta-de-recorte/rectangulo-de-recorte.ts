/**
 * Recorte de la rebanada A. Vive en la herramienta, no en el tablero.
 * Cerrar deja el rectángulo en null: no hay forma que guardar.
 */

export type RectanguloDeRecorte = {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
};

export type PuntoDeRecorte = {
  readonly x: number;
  readonly y: number;
};

export type SesionDeRecorte = {
  readonly abierta: boolean;
  readonly nombre: string;
  readonly rectangulo: RectanguloDeRecorte | null;
};

export const SESION_DE_RECORTE_CERRADA: SesionDeRecorte = {
  abierta: false,
  nombre: '',
  rectangulo: null,
};

export function abrirHerramienta(sesion: SesionDeRecorte): SesionDeRecorte {
  return { ...sesion, abierta: true };
}

export function nombrarDocumento(sesion: SesionDeRecorte, nombre: string): SesionDeRecorte {
  return { ...sesion, nombre };
}

export function enmarcar(sesion: SesionDeRecorte, rectangulo: RectanguloDeRecorte): SesionDeRecorte {
  return { ...sesion, rectangulo };
}

export function cerrarHerramienta(): SesionDeRecorte {
  return SESION_DE_RECORTE_CERRADA;
}

/** Un clic sin área no es una zona. El arrastre hacia cualquier lado sí. */
export function rectanguloDesdeArrastre(
  inicio: PuntoDeRecorte,
  fin: PuntoDeRecorte,
): RectanguloDeRecorte | null {
  const ancho = Math.abs(fin.x - inicio.x);
  const alto = Math.abs(fin.y - inicio.y);
  if (ancho === 0 || alto === 0) return null;
  return {
    x: Math.min(inicio.x, fin.x),
    y: Math.min(inicio.y, fin.y),
    ancho,
    alto,
  };
}

export function marcoVisible(sesion: SesionDeRecorte): boolean {
  return sesion.abierta && sesion.rectangulo !== null;
}
