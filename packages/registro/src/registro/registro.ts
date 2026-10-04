/**
 * Registro de eventos compartido por los tres procesos. Fijado en el paso A6.
 *
 * El mecanismo es: emitir un evento con contexto hacia un destino. Quién
 * escribe (consola, archivo, reenvío al orquestador) es un **destino**, y los
 * datos que acompañan al evento son el **contexto**. Agregar cualquiera de los
 * dos no toca este archivo.
 */

export type Nivel = 'info' | 'aviso' | 'error';

export type ValorDeContexto = string | number | boolean;

/** Datos que acompañan al evento. `sala` es la clave que permite seguir una sala completa. */
export type Contexto = Readonly<Record<string, ValorDeContexto>>;

export type Evento = {
  readonly instante: Date;
  readonly nivel: Nivel;
  readonly proceso: string;
  readonly contexto: Contexto;
  readonly mensaje: string;
};

/** Un destino recibe el evento ya armado y decide qué hacer con él. */
export type Destino = (evento: Evento) => void;

export type Registro = {
  info: (mensaje: string, contexto?: Contexto) => void;
  aviso: (mensaje: string, contexto?: Contexto) => void;
  error: (mensaje: string, contexto?: Contexto) => void;
  /** Registro hijo que arrastra este contexto en todas sus líneas. */
  con: (contexto: Contexto) => Registro;
};

export type OpcionesDeRegistro = {
  readonly proceso: string;
  readonly destino: Destino;
  /** Inyectable para que las pruebas no dependan del reloj real. */
  readonly reloj?: () => Date;
  readonly contexto?: Contexto;
};

export function crearRegistro(opciones: OpcionesDeRegistro): Registro {
  const { proceso, destino } = opciones;
  const reloj = opciones.reloj ?? (() => new Date());
  const heredado = opciones.contexto ?? {};

  const emitir = (nivel: Nivel, mensaje: string, contexto?: Contexto): void => {
    destino({
      instante: reloj(),
      nivel,
      proceso,
      contexto: contexto ? { ...heredado, ...contexto } : heredado,
      mensaje,
    });
  };

  return {
    info: (mensaje, contexto) => emitir('info', mensaje, contexto),
    aviso: (mensaje, contexto) => emitir('aviso', mensaje, contexto),
    error: (mensaje, contexto) => emitir('error', mensaje, contexto),
    con: (contexto) =>
      crearRegistro({
        proceso,
        destino,
        reloj,
        contexto: { ...heredado, ...contexto },
      }),
  };
}
