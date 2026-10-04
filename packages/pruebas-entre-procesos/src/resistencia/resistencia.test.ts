/**
 * Verificación del paso B7 con los procesos reales: matar el orquestador,
 * matar el host, partir la red del invitado e inyectar latencia. Después de
 * cada caída el camino vuelve solo, con el **mismo** proveedor: sin recargar.
 *
 * La red se estropea con el proxy de `proxy-de-red`, puesto entre un
 * invitado y el orquestador. El otro invitado va directo, como testigo.
 */

import type { ChildProcess } from 'node:child_process';

import { afterAll, describe, expect, it } from 'vitest';

import { invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import {
  type ProcesoLevantado,
  apagarTodos,
  esperarQue,
  levantar,
  puertoLibre,
} from '../levantar-proceso/levantar-proceso.ts';
import { type ProxyDeRed, proxyDeRed } from '../proxy-de-red/proxy-de-red.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';

const invitados: InvitadoDeLaSala[] = [];
const proxies: ProxyDeRed[] = [];

afterAll(async () => {
  for (const invitado of invitados.splice(0)) invitado.salir();
  await Promise.all(proxies.splice(0).map((proxy) => proxy.cerrar()));
  await apagarTodos();
});

function entrar(...argumentos: Parameters<typeof invitadoDeLaSala>): InvitadoDeLaSala {
  const invitado = invitadoDeLaSala(...argumentos);
  invitados.push(invitado);
  return invitado;
}

async function conProxy(puerto: number): Promise<ProxyDeRed> {
  const proxy = await proxyDeRed(puerto);
  proxies.push(proxy);
  return proxy;
}

function levantarOrquestador(puerto: number): Promise<ProcesoLevantado> {
  return levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
}

async function salaLevantada() {
  const puerto = await puertoLibre();
  const base = `ws://127.0.0.1:${puerto}`;
  const orquestador = await levantarOrquestador(puerto);
  const host = await levantar('apps/host/src/main.ts', { ORQUESTADOR_URL: base });
  const { sala, token } = invitacionDelHost(host);
  await esperarQue(() => registroDeLaSala(orquestador, sala));
  return { puerto, base, orquestador, host, sala, token };
}

function muerte(proceso: ChildProcess): Promise<{ codigo: number | null; senal: NodeJS.Signals | null }> {
  return new Promise((listo) => proceso.once('exit', (codigo, senal) => listo({ codigo, senal })));
}

/** Escribe en un mapa y espera a que el otro lo vea. */
async function cruza(de: InvitadoDeLaSala, a: InvitadoDeLaSala, clave: string, limite = 10_000): Promise<void> {
  de.documento.getMap('prueba').set(clave, true);
  await esperarQue(() => a.documento.getMap('prueba').get(clave) === true, limite);
}

describe('resistencia', () => {
  it(
    'el orquestador muere de golpe y vuelve: host e invitados se recuperan solos',
    async () => {
      const { puerto, base, orquestador, sala, token } = await salaLevantada();
      const ana = entrar({ base, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await cruza(ana, beto, 'antes');

      const murio = muerte(orquestador.proceso);
      orquestador.proceso.kill('SIGKILL');
      await murio;

      // Mientras no hay orquestador, cada quien sigue escribiendo en local.
      ana.documento.getMap('prueba').set('durante', true);
      await new Promise((listo) => setTimeout(listo, 2_000));

      const nuevo = await levantarOrquestador(puerto);
      await esperarQue(() => registroDeLaSala(nuevo, sala), 40_000);

      await esperarQue(() => beto.documento.getMap('prueba').get('durante') === true, 40_000);
      await cruza(beto, ana, 'despues');
      expect(ana.conexiones()).toBeGreaterThan(1);
      expect(ana.cierresDeSala).toEqual([]);
    },
    120_000,
  );

  it(
    'el orquestador se apaga limpio: termina con 0 y avisa a todos',
    async () => {
      const { orquestador } = await salaLevantada();

      const murio = muerte(orquestador.proceso);
      const inicio = Date.now();
      orquestador.proceso.kill('SIGTERM');
      const { codigo } = await murio;

      expect(codigo).toBe(0);
      expect(Date.now() - inicio).toBeLessThan(3_000);
      expect(orquestador.salida()).toContain('apagando');
    },
    30_000,
  );

  it(
    'el host cierra la sala: el invitado recibe la causa, no una caída',
    async () => {
      const { base, host, sala, token } = await salaLevantada();
      const ana = entrar({ base, sala, token, nombre: 'ana' });
      await esperarQue(() => ana.conexiones() === 1);

      const murio = muerte(host.proceso);
      host.proceso.kill('SIGTERM');
      await murio;

      await esperarQue(() => ana.cierresDeSala.length > 0, 5_000);
      expect(ana.cierresDeSala).toEqual(['host-cerro-la-sala']);
    },
    30_000,
  );

  it(
    'el host muere de golpe: el invitado ve una caída, no un cierre de sala',
    async () => {
      const { base, host, sala, token } = await salaLevantada();
      const ana = entrar({ base, sala, token, nombre: 'ana' });
      await esperarQue(() => ana.conexiones() === 1);

      const murio = muerte(host.proceso);
      host.proceso.kill('SIGKILL');
      await murio;

      await esperarQue(() => !ana.conectado(), 5_000);
      expect(ana.cierresDeSala).toEqual([]);
    },
    30_000,
  );

  it(
    'la red del invitado se parte diez segundos: al volver, lo escrito llega en los dos sentidos',
    async () => {
      const { puerto, base, sala, token } = await salaLevantada();
      const proxy = await conProxy(puerto);
      const ana = entrar({ base: `ws://127.0.0.1:${proxy.puerto}`, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await cruza(ana, beto, 'antes');

      proxy.partir();
      ana.documento.getMap('prueba').set('de-ana', true);
      beto.documento.getMap('prueba').set('de-beto', true);
      await new Promise((listo) => setTimeout(listo, 10_000));
      expect(ana.documento.getMap('prueba').get('de-beto')).toBeUndefined();

      proxy.unir();
      await esperarQue(() => ana.documento.getMap('prueba').get('de-beto') === true, 15_000);
      await esperarQue(() => beto.documento.getMap('prueba').get('de-ana') === true, 15_000);
    },
    60_000,
  );

  it(
    'la red del invitado se corta de golpe: reconecta solo y no pierde lo escrito',
    async () => {
      const { puerto, base, sala, token } = await salaLevantada();
      const proxy = await conProxy(puerto);
      const ana = entrar({ base: `ws://127.0.0.1:${proxy.puerto}`, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await cruza(ana, beto, 'antes');

      proxy.cortar();
      ana.documento.getMap('prueba').set('sin-red', true);

      await esperarQue(() => ana.conexiones() > 1, 30_000);
      await esperarQue(() => beto.documento.getMap('prueba').get('sin-red') === true, 15_000);
      await cruza(beto, ana, 'despues');
    },
    60_000,
  );

  it(
    'con 300 ms de latencia por trozo, los dos invitados convergen',
    async () => {
      const { puerto, base, sala, token } = await salaLevantada();
      const proxy = await conProxy(puerto);
      proxy.latencia(300);
      const ana = entrar({ base: `ws://127.0.0.1:${proxy.puerto}`, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => ana.conexiones() === 1, 15_000);

      for (let i = 0; i < 20; i++) {
        ana.documento.getArray('trazos').push([`ana-${i}`]);
        beto.documento.getArray('trazos').push([`beto-${i}`]);
      }

      const juntos = (): boolean =>
        ana.documento.getArray('trazos').length === 40 &&
        JSON.stringify(ana.documento.getArray('trazos').toJSON()) ===
          JSON.stringify(beto.documento.getArray('trazos').toJSON());
      await esperarQue(juntos, 20_000);
    },
    60_000,
  );
});
