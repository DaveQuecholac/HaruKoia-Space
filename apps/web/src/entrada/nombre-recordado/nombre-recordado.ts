/**
 * Nombre del participante. Fijado en B6 con D9: se pide al entrar, se recuerda
 * en el navegador y viaja solo en la presencia de la sala. El host no lo guarda.
 */

const CLAVE = 'harukoia:nombre';

export type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

export function leerNombre(almacen: Almacen): string | undefined {
  const nombre = almacen.getItem(CLAVE)?.trim();
  return nombre ? nombre : undefined;
}

export function guardarNombre(almacen: Almacen, nombre: string): void {
  almacen.setItem(CLAVE, nombre.trim());
}
