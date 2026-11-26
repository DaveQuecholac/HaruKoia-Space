/**
 * PDF escrito por este motor, con la fuente estándar Helvetica.
 * No llama a un conversor externo.
 */

import { bloquesDelMarkdown, type Bloque } from './bloques.ts';

const LINEAS_POR_PAGINA = 36;

export function pdfDelMarkdown(markdown: string): Uint8Array {
  const lineas = lineasDe(bloquesDelMarkdown(markdown));
  const paginas: string[][] = [];
  for (let i = 0; i < lineas.length; i += LINEAS_POR_PAGINA) {
    paginas.push(lineas.slice(i, i + LINEAS_POR_PAGINA));
  }
  if (paginas.length === 0) paginas.push(['']);
  return armarPdf(paginas.map((pagina) => flujo(pagina)));
}

function lineasDe(bloques: readonly Bloque[]): string[] {
  const lineas: string[] = [];
  for (const bloque of bloques) {
    const ancho = bloque.tipo === 'titulo' ? 48 : 85;
    const trozos = partir(bloque.texto, ancho);
    if (trozos.length === 0) lineas.push('');
    for (const trozo of trozos) lineas.push(trozo);
    if (bloque.tipo === 'titulo') lineas.push('');
  }
  return lineas.length === 0 ? [''] : lineas;
}

function partir(texto: string, ancho: number): string[] {
  const palabras = texto.split(/\s+/).filter((palabra) => palabra !== '');
  const lineas: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const candidato = actual === '' ? palabra : `${actual} ${palabra}`;
    if (candidato.length > ancho && actual !== '') {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = candidato;
    }
  }
  if (actual !== '') lineas.push(actual);
  return lineas;
}

function flujo(lineas: readonly string[]): string {
  const ordenes = ['BT', '/F1 12 Tf'];
  let y = 740;
  for (const linea of lineas) {
    ordenes.push(`1 0 0 1 72 ${y} Tm (${escapar(aLatin1(linea))}) Tj`);
    y -= 16;
  }
  ordenes.push('ET');
  return ordenes.join('\n');
}

function escapar(texto: string): string {
  return texto.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
}

function aLatin1(texto: string): string {
  let salida = '';
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0) ?? 63;
    salida += codigo <= 255 ? caracter : '?';
  }
  return salida;
}

function armarPdf(contenidos: readonly string[]): Uint8Array {
  const cantidad = contenidos.length;
  const fuente = 3 + cantidad * 2;
  const objetos: string[] = [];
  objetos.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const hijos = contenidos.map((_, indice) => `${3 + indice * 2} 0 R`).join(' ');
  objetos.push(`2 0 obj\n<< /Type /Pages /Count ${cantidad} /Kids [${hijos}] >>\nendobj\n`);
  contenidos.forEach((flujoDePagina, indice) => {
    const pagina = 3 + indice * 2;
    const contenido = pagina + 1;
    objetos.push(
      `${pagina} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contenido} 0 R /Resources << /Font << /F1 ${fuente} 0 R >> >> >>\nendobj\n`,
    );
    objetos.push(
      `${contenido} 0 obj\n<< /Length ${Buffer.byteLength(flujoDePagina, 'latin1')} >>\nstream\n${flujoDePagina}\nendstream\nendobj\n`,
    );
  });
  objetos.push(`${fuente} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  const encabezado = '%PDF-1.4\n';
  const partes = [encabezado];
  const desplazamientos = [0];
  let cursor = Buffer.byteLength(encabezado, 'latin1');
  for (const objeto of objetos) {
    desplazamientos.push(cursor);
    partes.push(objeto);
    cursor += Buffer.byteLength(objeto, 'latin1');
  }
  let xref = `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < desplazamientos.length; i += 1) {
    xref += `${String(desplazamientos[i]).padStart(10, '0')} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${cursor}\n%%EOF\n`;
  partes.push(xref);
  return Buffer.from(partes.join(''), 'latin1');
}
