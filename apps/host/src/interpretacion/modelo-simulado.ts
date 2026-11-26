/**
 * Modelo simulado de las pruebas de H6. El camino real no lo importa.
 * La misma imagen produce el mismo Markdown. No lee el tablero.
 */

import { createHash } from 'node:crypto';

export function interpretarConModeloSimulado(imagen: Uint8Array): string {
  const huella = createHash('sha256').update(imagen).digest('hex').slice(0, 12);
  return `# Interpretación\n\nZona ${huella}.\n`;
}
