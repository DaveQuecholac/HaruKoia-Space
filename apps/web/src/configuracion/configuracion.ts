/**
 * Configuración de la web, del `.env` de `apps/web`. Sin valores por defecto:
 * si falta una URL, la web lo dice en lugar de conectarse a otra cosa.
 */

export type Configuracion = {
  readonly orquestador: string;
  readonly host: string;
};

export function leerConfiguracion(): Configuracion | { readonly falta: string } {
  const orquestador = import.meta.env.VITE_ORQUESTADOR_URL as string | undefined;
  const host = import.meta.env.VITE_HOST_URL as string | undefined;
  if (!orquestador) return { falta: 'VITE_ORQUESTADOR_URL' };
  if (!host) return { falta: 'VITE_HOST_URL' };
  return { orquestador, host };
}
