/**
 * Formas del JSON propio de HaruKoia (H4-T1…T3).
 * No es el JSON interno de tldraw: el traductor mapea typeName ↔ `tipo`.
 *
 * Variante nueva = miembro de esta unión + manejador en el traductor.
 */

export const TIPOS_DE_FORMA = ['documento', 'pagina', 'figura', 'recurso', 'vinculo'] as const;

export type TipoDeForma = (typeof TIPOS_DE_FORMA)[number];

export type MetaDeForma = Readonly<Record<string, unknown>>;

export type FormaDocumento = {
  readonly tipo: 'documento';
  readonly id: string;
  readonly nombre: string;
  readonly tamanoDeGrilla: number;
  readonly meta: MetaDeForma;
};

export type FormaPagina = {
  readonly tipo: 'pagina';
  readonly id: string;
  readonly nombre: string;
  readonly indice: string;
  readonly meta: MetaDeForma;
};

/** Una figura del lienzo (geo, texto, trazo, etc.). `figura` es el subtipo. */
export type FormaFigura = {
  readonly tipo: 'figura';
  readonly id: string;
  readonly figura: string;
  readonly x: number;
  readonly y: number;
  readonly rotacion: number;
  readonly indice: string;
  readonly padre: string;
  readonly bloqueado: boolean;
  readonly opacidad: number;
  readonly props: MetaDeForma;
  readonly meta: MetaDeForma;
};

export type FormaRecurso = {
  readonly tipo: 'recurso';
  readonly id: string;
  readonly recurso: string;
  readonly props: MetaDeForma;
  readonly meta: MetaDeForma;
};

export type FormaVinculo = {
  readonly tipo: 'vinculo';
  readonly id: string;
  readonly vinculo: string;
  readonly desde: string;
  readonly hacia: string;
  readonly props: MetaDeForma;
  readonly meta: MetaDeForma;
};

export type FormaDeTablero = FormaDocumento | FormaPagina | FormaFigura | FormaRecurso | FormaVinculo;

export type InterpretacionDeForma =
  | { readonly ok: true; readonly forma: FormaDeTablero }
  | { readonly ok: false; readonly causa: 'no-objeto' | 'tipo-ausente' | 'tipo-desconocido' | 'campos-invalidos' };

export function esTipoDeForma(valor: unknown): valor is TipoDeForma {
  return typeof valor === 'string' && (TIPOS_DE_FORMA as readonly string[]).includes(valor);
}

export function interpretarForma(valor: unknown): InterpretacionDeForma {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) {
    return { ok: false, causa: 'no-objeto' };
  }
  const datos = valor as Record<string, unknown>;
  if (!('tipo' in datos)) {
    return { ok: false, causa: 'tipo-ausente' };
  }
  if (!esTipoDeForma(datos.tipo)) {
    return { ok: false, causa: 'tipo-desconocido' };
  }

  switch (datos.tipo) {
    case 'documento':
      return interpretarDocumento(datos);
    case 'pagina':
      return interpretarPagina(datos);
    case 'figura':
      return interpretarFigura(datos);
    case 'recurso':
      return interpretarRecurso(datos);
    case 'vinculo':
      return interpretarVinculo(datos);
  }
}

function interpretarDocumento(datos: Record<string, unknown>): InterpretacionDeForma {
  if (
    typeof datos.id !== 'string' ||
    typeof datos.nombre !== 'string' ||
    typeof datos.tamanoDeGrilla !== 'number' ||
    !Number.isFinite(datos.tamanoDeGrilla) ||
    !esMeta(datos.meta)
  ) {
    return { ok: false, causa: 'campos-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'documento',
      id: datos.id,
      nombre: datos.nombre,
      tamanoDeGrilla: datos.tamanoDeGrilla,
      meta: datos.meta,
    },
  };
}

function interpretarPagina(datos: Record<string, unknown>): InterpretacionDeForma {
  if (
    typeof datos.id !== 'string' ||
    typeof datos.nombre !== 'string' ||
    typeof datos.indice !== 'string' ||
    !esMeta(datos.meta)
  ) {
    return { ok: false, causa: 'campos-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'pagina',
      id: datos.id,
      nombre: datos.nombre,
      indice: datos.indice,
      meta: datos.meta,
    },
  };
}

function interpretarFigura(datos: Record<string, unknown>): InterpretacionDeForma {
  if (
    typeof datos.id !== 'string' ||
    typeof datos.figura !== 'string' ||
    typeof datos.x !== 'number' ||
    !Number.isFinite(datos.x) ||
    typeof datos.y !== 'number' ||
    !Number.isFinite(datos.y) ||
    typeof datos.rotacion !== 'number' ||
    !Number.isFinite(datos.rotacion) ||
    typeof datos.indice !== 'string' ||
    typeof datos.padre !== 'string' ||
    typeof datos.bloqueado !== 'boolean' ||
    typeof datos.opacidad !== 'number' ||
    !Number.isFinite(datos.opacidad) ||
    !esMeta(datos.props) ||
    !esMeta(datos.meta)
  ) {
    return { ok: false, causa: 'campos-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'figura',
      id: datos.id,
      figura: datos.figura,
      x: datos.x,
      y: datos.y,
      rotacion: datos.rotacion,
      indice: datos.indice,
      padre: datos.padre,
      bloqueado: datos.bloqueado,
      opacidad: datos.opacidad,
      props: datos.props,
      meta: datos.meta,
    },
  };
}

function interpretarRecurso(datos: Record<string, unknown>): InterpretacionDeForma {
  if (
    typeof datos.id !== 'string' ||
    typeof datos.recurso !== 'string' ||
    !esMeta(datos.props) ||
    !esMeta(datos.meta)
  ) {
    return { ok: false, causa: 'campos-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'recurso',
      id: datos.id,
      recurso: datos.recurso,
      props: datos.props,
      meta: datos.meta,
    },
  };
}

function interpretarVinculo(datos: Record<string, unknown>): InterpretacionDeForma {
  if (
    typeof datos.id !== 'string' ||
    typeof datos.vinculo !== 'string' ||
    typeof datos.desde !== 'string' ||
    typeof datos.hacia !== 'string' ||
    !esMeta(datos.props) ||
    !esMeta(datos.meta)
  ) {
    return { ok: false, causa: 'campos-invalidos' };
  }
  return {
    ok: true,
    forma: {
      tipo: 'vinculo',
      id: datos.id,
      vinculo: datos.vinculo,
      desde: datos.desde,
      hacia: datos.hacia,
      props: datos.props,
      meta: datos.meta,
    },
  };
}

function esMeta(valor: unknown): valor is MetaDeForma {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}
