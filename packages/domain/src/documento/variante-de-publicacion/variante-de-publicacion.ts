/**
 * Variante de formato del mecanismo de publicación (H5).
 * Hoy: markdown determinista. H6 agregará miembros (p. ej. markdown-con-ia).
 */

export const VARIANTES_DE_PUBLICACION = ['markdown-determinista'] as const;

export type VarianteDePublicacion = (typeof VARIANTES_DE_PUBLICACION)[number];

export function esVarianteDePublicacion(valor: unknown): valor is VarianteDePublicacion {
  return typeof valor === 'string' && (VARIANTES_DE_PUBLICACION as readonly string[]).includes(valor);
}
