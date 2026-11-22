/**
 * V5: checkout A tras B → tip = A; el siguiente commit cuelga de A.
 */

import { afterAll, describe, expect, it } from 'vitest';

import {
  ORIGEN_DE_LA_WEB_DE_PRUEBA,
  invitacionParaLaWeb,
  registroDeLaSala,
} from '../invitacion-del-host/invitacion-del-host.ts';
import { apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';

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
  const invitacion = await invitacionParaLaWeb(host);
  await esperarQue(() => registroDeLaSala(orquestador, invitacion.sala));
  return { base, host, ...invitacion };
}

function rolRecibido(invitado: InvitadoDeLaSala): string | undefined {
  const mensaje = invitado.mensajesDeSala.find((m) => m.tipo === 'tu-rol');
  return mensaje?.tipo === 'tu-rol' ? mensaje.rol : undefined;
}

describe('checkout de versión', () => {
  it(
    'A → B → checkout A → commit C con padre A',
    async () => {
      const { base, host: procesoHost, sala, token, tokenDeWebDelHost } = await salaLevantada();
      const host = entrar({ base, sala, token, nombre: 'hector', tokenDeWebDelHost });
      await esperarQue(() => rolRecibido(host) === 'host');

      const mapa = host.documento.getMap<string>('tablero');
      mapa.set(
        'page:inicio',
        JSON.stringify({
          id: 'page:inicio',
          typeName: 'page',
          name: 'Pagina A',
          index: 'a0',
          meta: {},
        }),
      );
      host.pedirAccion('commitear', 'A');
      await esperarQue(() => host.mensajesDeSala.some((m) => m.tipo === 'commit-guardado'), 10_000);
      const commitA = host.mensajesDeSala.find((m) => m.tipo === 'commit-guardado');
      if (commitA?.tipo !== 'commit-guardado') throw new Error('sin A');

      mapa.set(
        'page:inicio',
        JSON.stringify({
          id: 'page:inicio',
          typeName: 'page',
          name: 'Pagina B',
          index: 'a0',
          meta: {},
        }),
      );
      mapa.set(
        'shape:extra',
        JSON.stringify({
          id: 'shape:extra',
          typeName: 'shape',
          type: 'geo',
          x: 1,
          y: 2,
          rotation: 0,
          index: 'a1',
          parentId: 'page:inicio',
          isLocked: false,
          opacity: 1,
          props: { geo: 'rectangle', w: 10, h: 10 },
          meta: {},
        }),
      );
      host.pedirAccion('commitear', 'B');
      await esperarQue(
        () => host.mensajesDeSala.filter((m) => m.tipo === 'commit-guardado').length >= 2,
        10_000,
      );

      host.pedirAccion('hacer-checkout', commitA.id);
      await esperarQue(() => host.mensajesDeSala.some((m) => m.tipo === 'checkout-hecho'), 10_000);
      const hecho = host.mensajesDeSala.find((m) => m.tipo === 'checkout-hecho');
      expect(hecho).toMatchObject({ tipo: 'checkout-hecho', id: commitA.id });
      expect(procesoHost.salida()).toContain('acción ejecutada');

      await esperarQue(() => !mapa.has('shape:extra'), 5_000);
      const pagina = JSON.parse(String(mapa.get('page:inicio')));
      expect(pagina.name).toBe('Pagina A');

      host.pedirAccion('commitear', 'C');
      await esperarQue(
        () => host.mensajesDeSala.filter((m) => m.tipo === 'commit-guardado').length >= 3,
        10_000,
      );
      const commitC = [...host.mensajesDeSala].reverse().find((m) => m.tipo === 'commit-guardado');
      if (commitC?.tipo !== 'commit-guardado') throw new Error('sin C');
      expect(commitC.padre).toBe(commitA.id);
      expect(commitC.mensaje).toBe('C');
    },
    45_000,
  );
});
