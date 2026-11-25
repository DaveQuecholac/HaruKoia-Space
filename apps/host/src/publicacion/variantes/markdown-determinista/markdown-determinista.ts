/**
 * Plugin de la variante `markdown-determinista` (H5 / P5).
 * Produce `documento.md` + `tablero.json` en memoria (escritura = P6).
 */

import { rutasDePublicacionDelCommit } from '@harukoia/domain';

import { crearArtefactoDePublicacion } from '../../mecanismo/artefacto-de-publicacion.ts';
import type { VarianteDeFormato } from '../../mecanismo/variante-de-formato.ts';
import {
  bytesDelMarkdownDeterminista,
  bytesDelTableroJsonDeterminista,
} from './generar-markdown-determinista.ts';

export const ID_VARIANTE_MARKDOWN_DETERMINISTA = 'markdown-determinista' as const;

export function crearVarianteMarkdownDeterminista(): VarianteDeFormato {
  return {
    id: ID_VARIANTE_MARKDOWN_DETERMINISTA,
    async producir({ entrada }) {
      const rutas = rutasDePublicacionDelCommit(entrada.commit.id);

      const md = crearArtefactoDePublicacion(
        rutas.documentoMarkdown,
        bytesDelMarkdownDeterminista(entrada),
      );
      if (!md.ok) return { ok: false, causa: `documento.md:${md.causa}` };

      const json = crearArtefactoDePublicacion(
        rutas.tableroJson,
        bytesDelTableroJsonDeterminista(entrada.tablero),
      );
      if (!json.ok) return { ok: false, causa: `tablero.json:${json.causa}` };

      return { ok: true, artefactos: [md.artefacto, json.artefacto] };
    },
  };
}
