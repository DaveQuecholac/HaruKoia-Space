/**
 * POST /interpretacion. La web del host manda la imagen y el título.
 * Bedrock responde el Markdown y esta ruta lo guarda en Harukoia/documentacion.
 * Si el modelo falla, no hay archivo.
 */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { TokenDeWebDelHost } from '@harukoia/domain';

import { rutaDeMarkdown } from '../convertidor/escribir-conversiones.ts';
import { tituloDeDocumento } from './guardar-documento.ts';
import { esDeLaPropiaMaquina } from '../invitacion/invitacion.ts';

export const RUTA_DE_INTERPRETACION = '/interpretacion';
export const RUTA_DE_CONVERSION = '/interpretacion/convertir';

const LIMITE_DEL_CUERPO = 6 * 1024 * 1024;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

export type ModeloDeInterpretacion = (imagen: Uint8Array) => Promise<string>;

export type GuardarInterpretacion = (titulo: string, markdown: string) => Promise<string>;

export type ConvertirInterpretacion = (
  rutaMarkdown: string,
  markdown: string,
) => Promise<{ readonly word: string; readonly pdf: string }>;

export type OpcionesDeLaInterpretacion = {
  readonly origenDeLaWeb: string;
  readonly tokenDeWebDelHost: TokenDeWebDelHost;
  readonly modelo: ModeloDeInterpretacion;
  readonly guardar: GuardarInterpretacion;
  readonly convertir: ConvertirInterpretacion;
  readonly reintentar: (rutaMarkdown: string) => Promise<{ readonly word: string; readonly pdf: string }>;
  readonly alFallar?: (causa: string) => void;
};

export function atenderInterpretacion(
  req: IncomingMessage,
  res: ServerResponse,
  opciones: OpcionesDeLaInterpretacion,
): boolean {
  const ruta = req.url?.split('?')[0];
  if (ruta !== RUTA_DE_INTERPRETACION && ruta !== RUTA_DE_CONVERSION) return false;
  void completar(req, res, opciones, ruta === RUTA_DE_CONVERSION);
  return true;
}

async function completar(
  req: IncomingMessage,
  res: ServerResponse,
  opciones: OpcionesDeLaInterpretacion,
  reintento: boolean,
): Promise<void> {
  try {
    if (req.method === 'OPTIONS') {
      if (!origenPermitido(req, opciones.origenDeLaWeb)) {
        escribir(res, 403, { error: 'interpretación solo para la web del host de esta máquina' }, null);
        return;
      }
      res.writeHead(204, cabecerasCors(opciones.origenDeLaWeb));
      res.end();
      return;
    }

    if (req.method !== 'POST' || !origenPermitido(req, opciones.origenDeLaWeb) || !tokenCoincide(req, opciones.tokenDeWebDelHost)) {
      escribir(res, 403, { error: 'interpretación solo para la web del host de esta máquina' }, origenPermitido(req, opciones.origenDeLaWeb) ? opciones.origenDeLaWeb : null);
      return;
    }

    if (reintento) {
      await completarReintento(req, res, opciones);
      return;
    }

    const pedido = await leerPedido(req);
    if (!pedido) {
      escribir(res, 400, { error: 'la petición no trae la imagen de la zona' }, opciones.origenDeLaWeb);
      return;
    }
    if (!pedido.titulo) {
      escribir(res, 400, { error: 'ponle un nombre al documento' }, opciones.origenDeLaWeb);
      return;
    }

    const markdown = await opciones.modelo(pedido.imagen);
    if (markdown.trim() === '') throw new Error('markdown vacío');
    const ruta = await opciones.guardar(pedido.titulo, markdown);
    let word: string | null = null;
    let pdf: string | null = null;
    try {
      const convertido = await opciones.convertir(ruta, markdown);
      word = convertido.word;
      pdf = convertido.pdf;
    } catch (error) {
      opciones.alFallar?.(error instanceof Error ? error.message : String(error));
    }
    escribir(res, 200, { markdown, ruta, word, pdf }, opciones.origenDeLaWeb);
  } catch (error) {
    opciones.alFallar?.(error instanceof Error ? error.message : String(error));
    if (!res.headersSent) {
      escribir(res, 502, { error: 'no se pudo interpretar la zona' }, opciones.origenDeLaWeb);
    }
  }
}

async function completarReintento(
  req: IncomingMessage,
  res: ServerResponse,
  opciones: OpcionesDeLaInterpretacion,
): Promise<void> {
  const ruta = await leerRuta(req);
  if (!ruta) {
    escribir(res, 400, { error: 'la petición no trae el Markdown guardado' }, opciones.origenDeLaWeb);
    return;
  }
  const convertido = await opciones.reintentar(ruta);
  escribir(res, 200, { ruta, word: convertido.word, pdf: convertido.pdf }, opciones.origenDeLaWeb);
}

async function leerRuta(req: IncomingMessage): Promise<string | null> {
  const crudo = await leerCuerpo(req);
  let valor: unknown;
  try {
    valor = JSON.parse(crudo.toString('utf8'));
  } catch {
    return null;
  }
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const claves = Object.keys(valor);
  if (claves.length !== 1 || claves[0] !== 'ruta') return null;
  return rutaDeMarkdown((valor as { ruta: unknown }).ruta);
}

function origenPermitido(req: IncomingMessage, origenDeLaWeb: string): boolean {
  return esDeLaPropiaMaquina(req.socket.remoteAddress) && req.headers.origin === origenDeLaWeb;
}

function tokenCoincide(req: IncomingMessage, esperado: string): boolean {
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string') return false;
  const [esquema, token, sobra] = authorization.split(' ');
  if (esquema?.toLowerCase() !== 'bearer' || !token || sobra !== undefined) return false;
  const recibido = Buffer.from(token);
  const oficial = Buffer.from(esperado);
  return recibido.length === oficial.length && timingSafeEqual(recibido, oficial);
}

async function leerPedido(req: IncomingMessage): Promise<{ imagen: Uint8Array; titulo: string | null } | null> {
  const crudo = await leerCuerpo(req);
  let valor: unknown;
  try {
    valor = JSON.parse(crudo.toString('utf8'));
  } catch {
    return null;
  }
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  const claves = Object.keys(valor).sort();
  if (claves.length !== 2 || claves[0] !== 'imagen' || claves[1] !== 'nombre') return null;
  const cuerpo = valor as { imagen: unknown; nombre: unknown };
  if (typeof cuerpo.imagen !== 'string' || cuerpo.imagen === '' || !/^[A-Za-z0-9+/]+={0,2}$/.test(cuerpo.imagen)) return null;
  const bytes = Buffer.from(cuerpo.imagen, 'base64');
  if (bytes.length < PNG.length || !bytes.subarray(0, PNG.length).equals(PNG)) return null;
  return { imagen: bytes, titulo: tituloDeDocumento(cuerpo.nombre) };
}

function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    let total = 0;
    let rechazado = false;
    req.on('data', (trozo: Buffer) => {
      total += trozo.length;
      if (total > LIMITE_DEL_CUERPO) {
        rechazado = true;
        reject(new Error('cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      trozos.push(trozo);
    });
    req.on('end', () => {
      if (!rechazado) resolve(Buffer.concat(trozos));
    });
    req.on('error', (error) => {
      if (!rechazado) reject(error);
    });
  });
}

function cabecerasCors(origen: string): Record<string, string> {
  return {
    'access-control-allow-origin': origen,
    'access-control-allow-methods': 'POST',
    'access-control-allow-headers': 'authorization, content-type',
    vary: 'Origin',
    'cache-control': 'no-store',
  };
}

function escribir(res: ServerResponse, status: number, cuerpo: unknown, origen: string | null): void {
  res.writeHead(status, {
    'content-type': 'application/json',
    ...(origen ? cabecerasCors(origen) : { 'cache-control': 'no-store' }),
  });
  res.end(JSON.stringify(cuerpo));
}
