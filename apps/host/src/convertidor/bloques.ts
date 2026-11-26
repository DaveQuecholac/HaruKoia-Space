/**
 * Bloques del Markdown que el convertidor sabe pasar a Word y a PDF.
 * No lee el tablero. Un formato nuevo es otro miembro de la unión, no otro lector.
 */

export type Bloque =
  | { readonly tipo: 'titulo'; readonly nivel: 1 | 2 | 3; readonly texto: string }
  | { readonly tipo: 'parrafo'; readonly texto: string };

export type FormatoDeSalida = 'word' | 'pdf';

export const FORMATOS_DE_SALIDA = ['word', 'pdf'] as const satisfies readonly FormatoDeSalida[];

export function bloquesDelMarkdown(markdown: string): readonly Bloque[] {
  const bloques: Bloque[] = [];
  const lineas = markdown.replaceAll('\r\n', '\n').split('\n');
  let parrafo: string[] = [];
  const cerrar = () => {
    const texto = limpiar(parrafo.join(' '));
    if (texto !== '') bloques.push({ tipo: 'parrafo', texto });
    parrafo = [];
  };
  for (const linea of lineas) {
    const titulo = /^(#{1,3})\s+(.*)$/.exec(linea);
    if (titulo) {
      cerrar();
      const marcas = titulo[1] ?? '#';
      const nivel = marcas.length as 1 | 2 | 3;
      bloques.push({ tipo: 'titulo', nivel, texto: limpiar(titulo[2] ?? '') });
      continue;
    }
    if (linea.trim() === '') {
      cerrar();
      continue;
    }
    const item = /^[-*]\s+(.*)$/.exec(linea);
    if (item) {
      cerrar();
      bloques.push({ tipo: 'parrafo', texto: limpiar(item[1] ?? '') });
      continue;
    }
    parrafo.push(linea.trim());
  }
  cerrar();
  return bloques;
}

function limpiar(texto: string): string {
  return texto.replaceAll(/\*\*(.+?)\*\*/g, '$1').replaceAll(/`(.+?)`/g, '$1').trim();
}
