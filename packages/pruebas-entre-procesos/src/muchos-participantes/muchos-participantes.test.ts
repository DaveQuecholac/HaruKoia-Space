/**
 * Verificación del paso B9 con los procesos reales: la prueba que no se puede
 * saltar. Diez participantes sobre la misma sala, escribiendo a la vez,
 * entrando y saliendo en plena sesión.
 *
 * La latencia se **mide y se reporta**, no reprueba: un umbral en
 * milisegundos dependería de la máquina. Lo único que falla es que alguien no
 * reciba el cambio dentro del tiempo máximo.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import { medirLatencia, resumenDeLatencia } from '../latencia-de-la-sala/latencia-de-la-sala.ts';
import { apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';

const PARTICIPANTES = 10;
const RONDAS_DE_LATENCIA = 5;

const invitados: InvitadoDeLaSala[] = [];

afterAll(async () => {
  for (const invitado of invitados.splice(0)) invitado.salir();
  await apagarTodos();
});

function entrar(...argumentos: Parameters<typeof invitadoDeLaSala>): InvitadoDeLaSala {
  const invitado = invitadoDeLaSala(...argumentos);
  invitados.push(invitado);
  return invitado;
}

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

/** Cuántos participantes contó el host en su último cambio de presencia. */
function ultimoConteo(salida: string): number | undefined {
  const conteos = [...salida.matchAll(/participantes=(\d+) participantes cambiaron/g)];
  const ultimo = conteos.at(-1)?.[1];
  return ultimo === undefined ? undefined : Number(ultimo);
}

/** El estado del documento con las claves en orden, para compararlo entre participantes. */
function estadoDe(invitado: InvitadoDeLaSala): string {
  const contenido = invitado.documento.getMap('prueba').toJSON();
  return JSON.stringify(Object.entries(contenido).sort(([una], [otra]) => una.localeCompare(otra)));
}

function bitacoraDe(invitado: InvitadoDeLaSala): string[] {
  return invitado.documento.getArray<string>('bitacora').toArray();
}

const nombreNumero = (numero: number) => `participante-${String(numero).padStart(2, '0')}`;

describe('varios participantes a la vez', () => {
  it(
    'diez convergen al mismo estado después de escribir a la vez, y el host los cuenta a todos',
    async () => {
      const { base, host, sala, token } = await salaLevantada();

      const todos = Array.from({ length: PARTICIPANTES }, (_, indice) =>
        entrar({ base, sala, token, nombre: nombreNumero(indice + 1) }),
      );
      const nombres = todos.map((_, indice) => nombreNumero(indice + 1)).join();

      // La presencia refleja el número real, vista por cada uno y por el host.
      for (const invitado of todos) await esperarQue(() => invitado.nombresPresentes().join() === nombres, 30_000);
      await esperarQue(() => ultimoConteo(host.salida()) === PARTICIPANTES, 15_000);

      // Escriben a la vez: cada quien lo suyo, y los diez la misma clave.
      for (const [indice, invitado] of todos.entries()) {
        const mapa = invitado.documento.getMap('prueba');
        mapa.set(nombreNumero(indice + 1), indice);
        mapa.set('la-misma-clave', indice);
      }

      // Convergencia: el mismo estado en los diez, con las once claves.
      await esperarQue(() => todos.every((invitado) => estadoDe(invitado) === estadoDe(todos[0]!)), 30_000);
      const estado = Object.fromEntries(JSON.parse(estadoDe(todos[0]!)) as [string, number][]);
      expect(Object.keys(estado)).toHaveLength(PARTICIPANTES + 1);
      for (const [indice] of todos.entries()) expect(estado[nombreNumero(indice + 1)]).toBe(indice);

      // Y la latencia hasta el último de los diez, como punto de partida para H2.
      const medicion = await medirLatencia({
        escritor: todos[0]!.documento,
        observadores: todos.map((invitado) => invitado.documento),
        rondas: RONDAS_DE_LATENCIA,
      });
      expect(medicion.rondas).toHaveLength(RONDAS_DE_LATENCIA);
      console.log(resumenDeLatencia(medicion, PARTICIPANTES));
    },
    120_000,
  );

  it(
    'la lista sigue al número real mientras entran y salen, y quien vuelve no duplica ni pierde su trabajo',
    async () => {
      const { base, host, sala, token } = await salaLevantada();
      const presentes = new Map<string, InvitadoDeLaSala>();

      async function llega(nombre: string): Promise<void> {
        const invitado = entrar({ base, sala, token, nombre });
        presentes.set(nombre, invitado);
        invitado.documento.getArray<string>('bitacora').push([`lo de ${nombre}`]);
        await esperarQue(() => ultimoConteo(host.salida()) === presentes.size, 20_000);
      }

      async function seVa(nombre: string): Promise<void> {
        presentes.get(nombre)?.salir();
        presentes.delete(nombre);
        await esperarQue(() => ultimoConteo(host.salida()) === presentes.size, 20_000);
      }

      // Van llegando de uno en uno hasta diez: el conteo sube con cada entrada.
      for (let numero = 1; numero <= PARTICIPANTES; numero++) await llega(nombreNumero(numero));

      const esperado = [...presentes.keys()].map((nombre) => `lo de ${nombre}`).sort();
      for (const invitado of presentes.values()) {
        await esperarQue(() => bitacoraDe(invitado).length === PARTICIPANTES, 20_000);
        expect([...bitacoraDe(invitado)].sort()).toEqual(esperado);
      }

      // Se van tres en plena sesión.
      for (const numero of [1, 2, 3]) await seVa(nombreNumero(numero));
      const testigo = presentes.get(nombreNumero(PARTICIPANTES))!;
      await esperarQue(() => testigo.nombresPresentes().length === PARTICIPANTES - 3, 20_000);

      // Y uno vuelve: recibe lo de todos una sola vez, sin perder lo suyo.
      await llega(nombreNumero(1));
      const vuelto = presentes.get(nombreNumero(1))!;
      await esperarQue(() => bitacoraDe(vuelto).length === PARTICIPANTES + 1, 20_000);
      const suyo = bitacoraDe(vuelto).filter((linea) => linea === `lo de ${nombreNumero(1)}`);
      expect(suyo).toHaveLength(2); // lo de antes de irse y lo que acaba de escribir, sin copias
      await esperarQue(() => bitacoraDe(testigo).length === PARTICIPANTES + 1, 20_000);
      expect([...bitacoraDe(testigo)].sort()).toEqual([...bitacoraDe(vuelto)].sort());
    },
    120_000,
  );
});
