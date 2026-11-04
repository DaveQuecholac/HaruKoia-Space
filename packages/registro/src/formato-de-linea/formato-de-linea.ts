/**
 * Formato de la línea de log. Fijado en el paso A6.
 *
 *   2026-10-04T09:12:33.481Z info  orquestador sala=4k7m conexion=9b2 invitado entró
 *   └ instante ISO           └ niv └ proceso   └ contexto             └ mensaje
 *
 * Texto, no JSON: se lee con `tail` y se filtra con `grep sala=<id>` sin más
 * herramientas. La línea es **siempre** una sola: cualquier salto dentro del
 * mensaje o de un valor se escapa, porque un mensaje de varias líneas rompe el
 * filtrado justo cuando más se necesita, que es con un error.
 */

import type { Evento, Nivel, ValorDeContexto } from '../registro/registro.ts';

/** Ancho del nivel más largo, para que las columnas queden alineadas al leer. */
const ANCHO_DEL_NIVEL = Math.max(...(['info', 'aviso', 'error'] satisfies Nivel[]).map((n) => n.length));

function aUnaLinea(texto: string): string {
  return texto.replace(/\r\n|\r|\n/g, '\\n').replace(/[\u0000-\u001f\u007f]/g, ' ');
}

function formatearValor(valor: ValorDeContexto): string {
  const texto = aUnaLinea(String(valor));
  if (texto === '') return '""';
  if (!/[\s"]/.test(texto)) return texto;
  return `"${texto.replace(/"/g, '\\"')}"`;
}

export function formatearContexto(contexto: Readonly<Record<string, ValorDeContexto>>): string {
  return Object.entries(contexto)
    .map(([clave, valor]) => `${clave}=${formatearValor(valor)}`)
    .join(' ');
}

export function formatearLinea(evento: Evento): string {
  const partes = [
    evento.instante.toISOString(),
    evento.nivel.padEnd(ANCHO_DEL_NIVEL),
    aUnaLinea(evento.proceso),
    formatearContexto(evento.contexto),
    aUnaLinea(evento.mensaje),
  ];

  return partes.filter((parte) => parte !== '').join(' ');
}
