/**
 * Versión de formato del JSON del tablero (H4-T3).
 * Independiente del JSON interno de tldraw: el traductor (V1) es quien aísla ese detalle.
 *
 * Solo H4: sin documents ni attachments.
 */

import { type FormaDeTablero, interpretarForma } from '../forma-de-tablero/forma-de-tablero.ts';

/** Primera versión publicada del JSON propio de HaruKoia. */
export const FORMATO_DE_TABLERO = 1;

/**
 * Contenedor del tablero en JSON. Las formas son del contrato HaruKoia
 * (`FormaDeTablero`), no registros crudos de tldraw.
 */
export type TableroEnJson = {
  readonly formato: typeof FORMATO_DE_TABLERO;
  readonly formas: readonly FormaDeTablero[];
};

export type InterpretacionDeTablero =
  | { readonly ok: true; readonly tablero: TableroEnJson }
  | {
      readonly ok: false;
      readonly causa:
        | 'no-objeto'
        | 'formato-ausente'
        | 'formato-desconocido'
        | 'formas-invalidas'
        | 'forma-desconocida'
        | 'forma-invalida';
    };

export function tableroEnJsonVacio(): TableroEnJson {
  return { formato: FORMATO_DE_TABLERO, formas: [] };
}

export function interpretarTableroEnJson(valor: unknown): InterpretacionDeTablero {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'no-objeto' };
  }
  const datos = valor as Record<string, unknown>;
  if (!('formato' in datos)) {
    return { ok: false, causa: 'formato-ausente' };
  }
  if (datos.formato !== FORMATO_DE_TABLERO) {
    return { ok: false, causa: 'formato-desconocido' };
  }
  if (!Array.isArray(datos.formas)) {
    return { ok: false, causa: 'formas-invalidas' };
  }

  const formas: FormaDeTablero[] = [];
  for (const cruda of datos.formas) {
    const forma = interpretarForma(cruda);
    if (!forma.ok) {
      if (forma.causa === 'tipo-desconocido') {
        return { ok: false, causa: 'forma-desconocida' };
      }
      return { ok: false, causa: 'forma-invalida' };
    }
    formas.push(forma.forma);
  }

  return {
    ok: true,
    tablero: { formato: FORMATO_DE_TABLERO, formas },
  };
}
