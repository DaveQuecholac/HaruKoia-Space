/**
 * Verificación del paso B5 con los procesos reales: dos invitados comparten
 * documento y presencia a través del túnel, y un invitado que se congela
 * desaparece por tiempo de espera, sin quedar fantasma.
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import { apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from './invitado-de-la-sala.ts';

const invitados: InvitadoDeLaSala[] = [];

afterAll(async () => {
  for (const invitado of invitados.splice(0)) invitado.salir();
  await apagarTodos();
});

async function salaLevantada() {
  const puerto = await puertoLibre();
  const base = `ws://127.0.0.1:${puerto}`;
  const orquestador = await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
  const host = await levantar('apps/host/src/main.ts', {
    ORQUESTADOR_URL: base,
    WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
  });
  const { sala, token } = await invitacionDelHost(host);
  await esperarQue(() => registroDeLaSala(orquestador, sala));
  return { base, host, sala, token };
}

function entrar(...argumentos: Parameters<typeof invitadoDeLaSala>): InvitadoDeLaSala {
  const invitado = invitadoDeLaSala(...argumentos);
  invitados.push(invitado);
  return invitado;
}

/** Cuántos participantes contó el host en su último cambio de presencia. */
function ultimoConteo(salida: string): number | undefined {
  const conteos = [...salida.matchAll(/participantes=(\d+) participantes cambiaron/g)];
  const ultimo = conteos.at(-1)?.[1];
  return ultimo === undefined ? undefined : Number(ultimo);
}

describe('la sala en vivo a través del túnel', () => {
  it(
    'dos invitados comparten documento y presencia, y quien sale limpio desaparece',
    async () => {
      const { base, host, sala, token } = await salaLevantada();

      const ana = entrar({ base, sala, token, nombre: 'ana' });
      const beto = entrar({ base, sala, token, nombre: 'beto' });

      // Presencia: cada uno ve a los dos, y el host cuenta dos participantes.
      await esperarQue(() => ana.nombresPresentes().join() === 'ana,beto');
      await esperarQue(() => beto.nombresPresentes().join() === 'ana,beto');
      await esperarQue(() => ultimoConteo(host.salida()) === 2);

      // Estado: lo que escribe uno lo ve el otro, en ambos sentidos.
      ana.documento.getMap('prueba').set('de-ana', 1);
      await esperarQue(() => beto.documento.getMap('prueba').get('de-ana') === 1);
      beto.documento.getMap('prueba').set('de-beto', 2);
      await esperarQue(() => ana.documento.getMap('prueba').get('de-beto') === 2);

      // Salida limpia: desaparece enseguida, no a los 30 s.
      ana.salir();
      await esperarQue(() => beto.nombresPresentes().join() === 'beto', 5_000);
      await esperarQue(() => ultimoConteo(host.salida()) === 1, 5_000);

      // El host mantiene el documento: quien llega después recibe lo escrito.
      beto.salir();
      await esperarQue(() => ultimoConteo(host.salida()) === 0, 5_000);
      const carla = entrar({ base, sala, token, nombre: 'carla' });
      await esperarQue(() => carla.documento.getMap('prueba').get('de-beto') === 2);
    },
    60_000,
  );

  it(
    'rechaza un documento que no es el de la sala',
    async () => {
      const { base, host, sala, token } = await salaLevantada();

      entrar({ base, sala, token, nombre: 'intruso', documento: 'otro-documento' });

      await esperarQue(() => host.salida().includes('documento ajeno a la sala, rechazado'));
    },
    30_000,
  );

  it(
    'un invitado congelado desaparece por tiempo de espera, sin quedar fantasma',
    async () => {
      const { base, host, sala, token } = await salaLevantada();
      const testigo = entrar({ base, sala, token, nombre: 'testigo' });

      const script = fileURLToPath(new URL('./invitado-en-proceso.ts', import.meta.url));
      const congelado = spawn(process.execPath, [script, base, sala, token, 'congelado'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let salidaDelCongelado = '';
      congelado.stdout.on('data', (trozo: Buffer) => (salidaDelCongelado += trozo.toString()));
      congelado.stderr.on('data', (trozo: Buffer) => (salidaDelCongelado += trozo.toString()));

      try {
        await esperarQue(() => testigo.nombresPresentes().join() === 'congelado,testigo', 15_000);
        const cerradasAntes = host.salida().split('conexión de datos cerrada').length;

        // Como una laptop que se suspende: el socket sigue abierto y mudo.
        congelado.kill('SIGSTOP');
        const congeladoEn = Date.now();

        // Diez segundos después sigue presente: no hubo cierre que avisara.
        await new Promise((listo) => setTimeout(listo, 10_000));
        expect(testigo.nombresPresentes()).toContain('congelado');

        // Su presencia caduca a los 30 s sin renovarse.
        await esperarQue(() => testigo.nombresPresentes().join() === 'testigo', 35_000);
        await esperarQue(() => ultimoConteo(host.salida()) === 1, 5_000);

        // Y el host suelta la conexión muerta, en vez de cargarla para siempre.
        await esperarQue(
          () => host.salida().split('conexión de datos cerrada').length > cerradasAntes,
          65_000 - (Date.now() - congeladoEn),
        );
      } catch (falla) {
        throw new Error(`${String(falla)}\n--- invitado congelado ---\n${salidaDelCongelado}\n--- host ---\n${host.salida()}`);
      } finally {
        congelado.kill('SIGKILL');
      }
    },
    90_000,
  );
});
