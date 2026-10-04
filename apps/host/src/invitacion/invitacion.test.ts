import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { generarIdentidadDeSala } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import { RUTA_DE_INVITACION, atenderInvitacion, esDeLaPropiaMaquina } from './invitacion.ts';

const identidad = generarIdentidadDeSala();
const origenDeLaWeb = 'https://web.harukoia.local.iokoia.dev';

let servidor: Server | undefined;

afterEach(async () => {
  const abierto = servidor;
  servidor = undefined;
  if (abierto) await new Promise((listo) => abierto.close(listo));
});

async function hostConInvitacion(): Promise<string> {
  servidor = createServer((req, res) => {
    if (atenderInvitacion(req, res, { identidad, origenDeLaWeb })) return;
    res.writeHead(404).end();
  });
  await new Promise<void>((listo) => servidor?.listen(0, '127.0.0.1', listo));
  return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}${RUTA_DE_INVITACION}`;
}

describe('invitación del host', () => {
  it('entrega sala y token de invitación a la web de esta máquina, y nunca el token de host', async () => {
    const respuesta = await fetch(await hostConInvitacion(), { headers: { origin: origenDeLaWeb } });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('access-control-allow-origin')).toBe(origenDeLaWeb);
    expect(respuesta.headers.get('cache-control')).toBe('no-store');
    const cuerpo = await respuesta.text();
    expect(JSON.parse(cuerpo)).toEqual({ sala: identidad.sala, tokenDeInvitacion: identidad.tokenDeInvitacion });
    expect(cuerpo).not.toContain(identidad.tokenDeHost);
  });

  it('rechaza otro origen o una petición sin origen', async () => {
    const url = await hostConInvitacion();

    const ajena = await fetch(url, { headers: { origin: 'https://pagina-cualquiera.example' } });
    const sinOrigen = await fetch(url);

    expect(ajena.status).toBe(403);
    expect(ajena.headers.get('access-control-allow-origin')).toBeNull();
    expect(await ajena.text()).not.toContain(identidad.tokenDeInvitacion);
    expect(sinOrigen.status).toBe(403);
  });

  it('solo cuenta como propia máquina la dirección de loopback', () => {
    expect(esDeLaPropiaMaquina('127.0.0.1')).toBe(true);
    expect(esDeLaPropiaMaquina('::1')).toBe(true);
    expect(esDeLaPropiaMaquina('::ffff:127.0.0.1')).toBe(true);
    expect(esDeLaPropiaMaquina('10.0.1.7')).toBe(false);
    expect(esDeLaPropiaMaquina(undefined)).toBe(false);
  });
});
