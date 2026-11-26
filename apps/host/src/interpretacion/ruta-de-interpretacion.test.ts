import { mkdtemp, readFile, rm, unlink } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { generarIdentidadDeSala } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { escribirConversiones, reintentarConversion } from '../convertidor/escribir-conversiones.ts';
import { guardarDocumento } from './guardar-documento.ts';
import { interpretarConModeloSimulado } from './modelo-simulado.ts';
import { RUTA_DE_INTERPRETACION, atenderInterpretacion } from './ruta-de-interpretacion.ts';

const identidad = generarIdentidadDeSala();
const origenDeLaWeb = 'https://web.harukoia.local.iokoia.dev';
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7]);

let servidor: Server | undefined;
let raiz: string | undefined;
let modeloLlamado = 0;
let guardarLlamado = 0;

afterEach(async () => {
  const abierto = servidor;
  servidor = undefined;
  modeloLlamado = 0;
  guardarLlamado = 0;
  if (abierto) await new Promise((listo) => abierto.close(listo));
  if (raiz) await rm(raiz, { recursive: true, force: true });
  raiz = undefined;
});

async function host(modelo: (imagen: Uint8Array) => Promise<string> = async (imagen) => interpretarConModeloSimulado(imagen)): Promise<string> {
  raiz = await mkdtemp(path.join(tmpdir(), 'harukoia-ruta-'));
  const checkout = raiz;
  servidor = createServer((req, res) => {
    if (
      atenderInterpretacion(req, res, {
        origenDeLaWeb,
        tokenDeWebDelHost: identidad.tokenDeWebDelHost,
        modelo: async (imagen) => {
          modeloLlamado += 1;
          return modelo(imagen);
        },
        guardar: async (titulo, markdown) => {
          guardarLlamado += 1;
          return guardarDocumento(checkout, titulo, markdown);
        },
        convertir: (ruta, markdown) => escribirConversiones(checkout, ruta, markdown),
        reintentar: (ruta) => reintentarConversion(checkout, ruta),
      })
    ) {
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((listo) => servidor?.listen(0, '127.0.0.1', listo));
  return `http://127.0.0.1:${(servidor?.address() as AddressInfo).port}${RUTA_DE_INTERPRETACION}`;
}

function pedido(url: string, cuerpo: unknown, token: string = identidad.tokenDeWebDelHost) {
  return fetch(url, {
    method: 'POST',
    headers: {
      origin: origenDeLaWeb,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(
      typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) && 'imagen' in cuerpo && !('nombre' in cuerpo)
        ? { ...cuerpo, nombre: 'Perros bonitos' }
        : cuerpo,
    ),
  });
}

describe('ruta de interpretación', () => {
  it('con el modelo simulado, la misma imagen devuelve su Markdown', async () => {
    const url = await host();
    const cuerpo = { imagen: png.toString('base64') };

    const primera = await pedido(url, cuerpo);
    const segunda = await pedido(url, cuerpo);

    expect(primera.status).toBe(200);
    const uno = (await primera.json()) as { markdown: string; ruta: string };
    const dos = (await segunda.json()) as { markdown: string; ruta: string };
    expect(uno.markdown).toBe(interpretarConModeloSimulado(png));
    expect(dos.markdown).toBe(uno.markdown);
    expect(uno.ruta).toBe('Harukoia/documentacion/Perros bonitos.md');
    expect(dos.ruta).toBe('Harukoia/documentacion/Perros bonitos v2.md');
    expect(await readFile(path.join(raiz ?? '', uno.ruta), 'utf8')).toBe(uno.markdown);
    expect(await readFile(path.join(raiz ?? '', dos.ruta), 'utf8')).toBe(dos.markdown);
    expect(uno).toMatchObject({
      word: 'Harukoia/documentacion/Perros bonitos.docx',
      pdf: 'Harukoia/documentacion/Perros bonitos.pdf',
    });
  });

  it('borrar el Word y reintentar no llama al modelo y deja el Markdown', async () => {
    const url = await host();
    const creada = await pedido(url, { imagen: png.toString('base64') });
    const uno = (await creada.json()) as { markdown: string; ruta: string; word: string };
    const antes = await readFile(path.join(raiz ?? '', uno.ruta));
    await unlink(path.join(raiz ?? '', uno.word));
    const llamadas = modeloLlamado;

    const reintento = await pedido(`${url}/convertir`, { ruta: uno.ruta });

    expect(reintento.status).toBe(200);
    expect(await reintento.json()).toMatchObject({ word: uno.word });
    expect(modeloLlamado).toBe(llamadas);
    expect(await readFile(path.join(raiz ?? '', uno.ruta))).toEqual(antes);
    expect((await readFile(path.join(raiz ?? '', uno.word))).subarray(0, 2).toString()).toBe('PK');
  });

  it('rechaza un cuerpo que trae algo además de la imagen, y no llama al modelo', async () => {
    const url = await host();

    const respuesta = await pedido(url, { imagen: png.toString('base64'), tablero: { shapes: [] } });

    expect(respuesta.status).toBe(400);
    expect(modeloLlamado).toBe(0);
  });

  it('si el modelo falla, responde error y no escribe archivo', async () => {
    const url = await host(async () => {
      throw new Error('bedrock caído');
    });

    const respuesta = await pedido(url, { imagen: png.toString('base64') });

    expect(respuesta.status).toBe(502);
    expect(await respuesta.json()).toEqual({ error: 'no se pudo interpretar la zona' });
    expect(guardarLlamado).toBe(0);
  });

  it('rechaza a quien no presenta el token de la web del host', async () => {
    const url = await host();

    const ajeno = await pedido(url, { imagen: png.toString('base64') }, 'otro-token-de-web');
    const otroOrigen = await fetch(url, {
      method: 'POST',
      headers: {
        origin: 'https://pagina-cualquiera.example',
        authorization: `Bearer ${identidad.tokenDeWebDelHost}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ imagen: png.toString('base64') }),
    });

    expect(ajeno.status).toBe(403);
    expect(otroOrigen.status).toBe(403);
    expect(modeloLlamado).toBe(0);
  });
});
