/**
 * Estado del push de un documento publicado (H5 / H5-T7).
 * No es el estado de la sala ni el del commit de pizarra.
 *
 * “publicado” solo después de escritura + git push OK (plan P7→P8).
 * Reintento es una acción sobre un fallido, no un estado aparte.
 */

export const ESTADOS_DE_PUSH = ['en-proceso', 'publicado', 'fallido'] as const;

export type TipoDeEstadoDePush = (typeof ESTADOS_DE_PUSH)[number];

export type EstadoDePush =
  | { readonly tipo: 'en-proceso' }
  | { readonly tipo: 'publicado'; readonly publicadoEn: number }
  | { readonly tipo: 'fallido'; readonly causa: string; readonly fallidoEn: number };

export function esTipoDeEstadoDePush(valor: unknown): valor is TipoDeEstadoDePush {
  return typeof valor === 'string' && (ESTADOS_DE_PUSH as readonly string[]).includes(valor);
}

export type ResultadoDeEstadoDePush =
  | { readonly ok: true; readonly estado: EstadoDePush }
  | {
      readonly ok: false;
      readonly causa: 'tipo-invalido' | 'publicado-en-invalido' | 'fallido-invalido' | 'causa-vacia';
    };

export function comoEstadoDePush(valor: unknown): ResultadoDeEstadoDePush {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'tipo-invalido' };
  }
  const datos = valor as Record<string, unknown>;
  if (!esTipoDeEstadoDePush(datos.tipo)) {
    return { ok: false, causa: 'tipo-invalido' };
  }

  if (datos.tipo === 'en-proceso') {
    return { ok: true, estado: { tipo: 'en-proceso' } };
  }

  if (datos.tipo === 'publicado') {
    if (!Number.isFinite(datos.publicadoEn) || (datos.publicadoEn as number) < 0) {
      return { ok: false, causa: 'publicado-en-invalido' };
    }
    return { ok: true, estado: { tipo: 'publicado', publicadoEn: datos.publicadoEn as number } };
  }

  if (typeof datos.causa !== 'string' || datos.causa.trim() === '') {
    return { ok: false, causa: 'causa-vacia' };
  }
  if (!Number.isFinite(datos.fallidoEn) || (datos.fallidoEn as number) < 0) {
    return { ok: false, causa: 'fallido-invalido' };
  }
  return {
    ok: true,
    estado: {
      tipo: 'fallido',
      causa: datos.causa.trim(),
      fallidoEn: datos.fallidoEn as number,
    },
  };
}
