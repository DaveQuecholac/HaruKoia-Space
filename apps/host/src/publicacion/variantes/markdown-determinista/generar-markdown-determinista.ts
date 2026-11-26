/**
 * Markdown determinista a partir de un commit de pizarra (H5 / P5 / H5-T6).
 *
 * Mismo input → mismos bytes. Sin red, sin modelo, sin reloj del sistema
 * (usa solo `entrada.commit.creadoEn`).
 *
 * Contenido mínimo acordado en fase 1: versión, participantes, fecha,
 * datos del tablero. Secciones “bonitas” con IA = H6.
 */

import type { FormaDeTablero, TableroEnJson } from '@harukoia/domain';

import type { EntradaDePublicacion } from '../../mecanismo/variante-de-formato.ts';

const CODIFICADOR = new TextEncoder();

/** Una línea de lista markdown: escapa saltos que romperían el formato. */
function lineaLista(etiqueta: string, valor: string): string {
  const seguro = valor.replaceAll('\r\n', '\n').replaceAll('\n', '\\n').replaceAll('\r', '\\n');
  return `- ${etiqueta}: ${seguro}`;
}

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenarClaves);
  }
  if (valor !== null && typeof valor === 'object') {
    const entradas = Object.entries(valor as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b, 'en'),
    );
    const ordenado: Record<string, unknown> = {};
    for (const [clave, hijo] of entradas) {
      ordenado[clave] = ordenarClaves(hijo);
    }
    return ordenado;
  }
  return valor;
}

function jsonEstable(valor: unknown): string {
  return JSON.stringify(ordenarClaves(valor));
}

function lineasDeForma(forma: FormaDeTablero): string[] {
  switch (forma.tipo) {
    case 'documento':
      return [
        `- documento id=${forma.id}`,
        `  nombre: ${forma.nombre.replaceAll('\n', '\\n')}`,
        `  tamanoDeGrilla: ${forma.tamanoDeGrilla}`,
        `  meta: ${jsonEstable(forma.meta)}`,
      ];
    case 'pagina':
      return [
        `- pagina id=${forma.id}`,
        `  nombre: ${forma.nombre.replaceAll('\n', '\\n')}`,
        `  indice: ${forma.indice}`,
        `  meta: ${jsonEstable(forma.meta)}`,
      ];
    case 'figura':
      return [
        `- figura id=${forma.id}`,
        `  figura: ${forma.figura}`,
        `  x: ${forma.x}`,
        `  y: ${forma.y}`,
        `  rotacion: ${forma.rotacion}`,
        `  indice: ${forma.indice}`,
        `  padre: ${forma.padre}`,
        `  bloqueado: ${forma.bloqueado}`,
        `  opacidad: ${forma.opacidad}`,
        `  props: ${jsonEstable(forma.props)}`,
        `  meta: ${jsonEstable(forma.meta)}`,
      ];
    case 'recurso':
      return [
        `- recurso id=${forma.id}`,
        `  recurso: ${forma.recurso}`,
        `  props: ${jsonEstable(forma.props)}`,
        `  meta: ${jsonEstable(forma.meta)}`,
      ];
    case 'vinculo':
      return [
        `- vinculo id=${forma.id}`,
        `  vinculo: ${forma.vinculo}`,
        `  desde: ${forma.desde}`,
        `  hacia: ${forma.hacia}`,
        `  props: ${jsonEstable(forma.props)}`,
        `  meta: ${jsonEstable(forma.meta)}`,
      ];
  }
}

/**
 * Tablero serializado de forma estable (formas por id, claves ordenadas).
 * Misma entrada → mismos bytes UTF-8.
 */
export function generarTableroJsonDeterminista(tablero: TableroEnJson): string {
  const formas = [...tablero.formas].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return `${jsonEstable({ formato: tablero.formato, formas })}\n`;
}

export function generarMarkdownDeterminista(entrada: EntradaDePublicacion): string {
  const { commit, tablero } = entrada;
  const participantes = [...commit.participantes].sort((a, b) => a.localeCompare(b, 'en'));
  const fechaIso = new Date(commit.creadoEn).toISOString();

  const lineas: string[] = [
    '# Publicación HaruKoia',
    '',
    '## Versión',
    '',
    lineaLista('id', commit.id),
    lineaLista('mensaje', commit.mensaje),
    lineaLista('autor', commit.autor),
    '',
    '## Participantes',
    '',
  ];

  if (participantes.length === 0) {
    lineas.push('- (ninguno)');
  } else {
    for (const nombre of participantes) {
      lineas.push(`- ${nombre.replaceAll('\n', '\\n')}`);
    }
  }

  lineas.push(
    '',
    '## Fecha',
    '',
    lineaLista('creadoEn', fechaIso),
    '',
    '## Tablero',
    '',
    lineaLista('formato', String(tablero.formato)),
    lineaLista('formas', String(tablero.formas.length)),
    '',
  );

  if (tablero.formas.length > 0) {
    lineas.push('### Formas', '');
    const ordenadas = [...tablero.formas].sort((a, b) => a.id.localeCompare(b.id, 'en'));
    for (const forma of ordenadas) {
      lineas.push(...lineasDeForma(forma), '');
    }
  }

  // Siempre termina en una sola línea en blanco final.
  while (lineas.length > 0 && lineas[lineas.length - 1] === '') {
    lineas.pop();
  }
  return `${lineas.join('\n')}\n`;
}

export function bytesDelMarkdownDeterminista(entrada: EntradaDePublicacion): Uint8Array {
  return CODIFICADOR.encode(generarMarkdownDeterminista(entrada));
}

export function bytesDelTableroJsonDeterminista(tablero: TableroEnJson): Uint8Array {
  return CODIFICADOR.encode(generarTableroJsonDeterminista(tablero));
}
