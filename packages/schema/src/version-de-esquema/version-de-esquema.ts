/**
 * Versión de esquema y migración. Fijado en el paso A5.
 *
 * Cada colección declara su versión. Un documento guardado con una versión
 * anterior se migra **al leerlo**, aplicando en cadena las migraciones que le
 * faltan. No hay migración hacia atrás: una versión publicada no se reescribe.
 *
 * Qué colecciones existen y qué campos tiene cada una se decide en la épica que
 * las usa, no aquí.
 */

export type DocumentoCrudo = Record<string, unknown>;

/** Lleva un documento de la versión `desde` a la versión `desde + 1`. */
export type Migracion = (documento: DocumentoCrudo) => DocumentoCrudo;

export type DefinicionDeEsquema = {
  readonly nombre: string;
  readonly version: number;
  /** Clave: versión de origen. Debe cubrir de 0 a `version - 1`, sin huecos. */
  readonly migraciones: Readonly<Record<number, Migracion>>;
};

export function validarDefinicion(definicion: DefinicionDeEsquema): void {
  const { nombre, version, migraciones } = definicion;

  if (!Number.isInteger(version) || version < 0) {
    throw new RangeError(`${nombre}: la versión debe ser un entero no negativo`);
  }

  for (let origen = 0; origen < version; origen += 1) {
    if (typeof migraciones[origen] !== 'function') {
      throw new Error(`${nombre}: falta la migración de la versión ${origen} a la ${origen + 1}`);
    }
  }

  const sobrantes = Object.keys(migraciones)
    .map(Number)
    .filter((origen) => origen >= version);

  if (sobrantes.length > 0) {
    throw new Error(
      `${nombre}: hay migraciones para versiones que no existen: ${sobrantes.join(', ')}`,
    );
  }
}

/**
 * Aplica en cadena las migraciones que le faltan al documento. Un documento que
 * ya está en la versión vigente se devuelve tal cual.
 */
export function migrar(
  documento: DocumentoCrudo,
  versionDelDocumento: number,
  definicion: DefinicionDeEsquema,
): DocumentoCrudo {
  if (!Number.isInteger(versionDelDocumento) || versionDelDocumento < 0) {
    throw new RangeError(`${definicion.nombre}: versión de documento inválida`);
  }

  if (versionDelDocumento > definicion.version) {
    throw new Error(
      `${definicion.nombre}: el documento viene de la versión ${versionDelDocumento}, posterior a la vigente ${definicion.version}. No se migra hacia atrás`,
    );
  }

  let migrado = documento;

  for (let origen = versionDelDocumento; origen < definicion.version; origen += 1) {
    const migracion = definicion.migraciones[origen];
    if (!migracion) {
      throw new Error(
        `${definicion.nombre}: falta la migración de la versión ${origen} a la ${origen + 1}`,
      );
    }
    migrado = migracion(migrado);
  }

  return migrado;
}
