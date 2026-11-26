/**
 * Word (.docx) escrito por este motor. Es un zip sin compresión con el XML mínimo.
 * No llama a un conversor externo.
 */

import { bloquesDelMarkdown, type Bloque } from './bloques.ts';

export function wordDelMarkdown(markdown: string): Uint8Array {
  const cuerpo = bloquesDelMarkdown(markdown)
    .map((bloque) => parrafo(bloque))
    .join('');
  const documento = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${cuerpo}<w:sectPr/></w:body></w:document>`;
  return zipSinCompresion([
    { nombre: '[Content_Types].xml', datos: utf8(TIPOS) },
    { nombre: '_rels/.rels', datos: utf8(RELS) },
    { nombre: 'word/document.xml', datos: utf8(documento) },
  ]);
}

function parrafo(bloque: Bloque): string {
  const puntos = bloque.tipo === 'titulo' ? (bloque.nivel === 1 ? 32 : bloque.nivel === 2 ? 28 : 24) : 22;
  const negrita = bloque.tipo === 'titulo' ? '<w:b/>' : '';
  return `<w:p><w:r><w:rPr>${negrita}<w:sz w:val="${puntos}"/></w:rPr><w:t xml:space="preserve">${escaparXml(bloque.texto)}</w:t></w:r></w:p>`;
}

function escaparXml(texto: string): string {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

const TIPOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

function utf8(texto: string): Uint8Array {
  return new TextEncoder().encode(texto);
}

function zipSinCompresion(archivos: readonly { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;
  for (const archivo of archivos) {
    const nombre = utf8(archivo.nombre);
    const crc = crc32(archivo.datos);
    const local = Buffer.alloc(30 + nombre.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(archivo.datos.length, 18);
    local.writeUInt32LE(archivo.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    Buffer.from(nombre).copy(local, 30);
    locales.push(local, archivo.datos);
    const central = Buffer.alloc(46 + nombre.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(archivo.datos.length, 20);
    central.writeUInt32LE(archivo.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(offset, 42);
    Buffer.from(nombre).copy(central, 46);
    centrales.push(central);
    offset += local.length + archivo.datos.length;
  }
  const tamanoCentral = centrales.reduce((suma, parte) => suma + parte.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(tamanoCentral, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, ...centrales, fin]);
}

function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of datos) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) === 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
