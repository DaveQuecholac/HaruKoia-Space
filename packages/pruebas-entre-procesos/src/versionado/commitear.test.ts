/**
 * V3: espectador no puede commitear; el host sí y recibe commit-guardado.
 * V4: al conectar llega `historial`; el aviso de commit llega a todos.
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

describe('commitear entre procesos', () => {
  it(
    'un espectador pide commitear a mano: se rechaza',
    async () => {
      const { base, host: procesoHost, sala, token } = await salaLevantada();
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => rolRecibido(beto) === 'espectador');

      beto.pedirAccion('commitear', 'no debería');

      await esperarQue(() => beto.mensajesDeSala.some((m) => m.tipo === 'accion-rechazada'));
      expect(beto.mensajesDeSala).toContainEqual({
        tipo: 'accion-rechazada',
        accion: 'commitear',
        causa: 'rol-insuficiente',
      });
      expect(procesoHost.salida()).toContain('acción rechazada');
    },
    30_000,
  );

  it(
    'el host comitea: aviso commit-guardado con mensaje y sin padre',
    async () => {
      const { base, host: procesoHost, sala, token, tokenDeWebDelHost } = await salaLevantada();
      const host = entrar({ base, sala, token, nombre: 'hector', tokenDeWebDelHost });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => rolRecibido(host) === 'host' && rolRecibido(beto) === 'espectador');
      await esperarQue(
        () =>
          host.mensajesDeSala.some((m) => m.tipo === 'historial') &&
          beto.mensajesDeSala.some((m) => m.tipo === 'historial'),
      );
      expect(host.mensajesDeSala.find((m) => m.tipo === 'historial')).toMatchObject({
        tipo: 'historial',
        commits: [],
        tip: null,
      });

      host.documento.getMap('tablero').set(
        'page:inicio',
        JSON.stringify({
          id: 'page:inicio',
          typeName: 'page',
          name: 'Inicio',
          index: 'a0',
          meta: {},
        }),
      );

      host.pedirAccion('commitear', 'primera versión');

      await esperarQue(() => host.mensajesDeSala.some((m) => m.tipo === 'commit-guardado'), 10_000);
      const aviso = host.mensajesDeSala.find((m) => m.tipo === 'commit-guardado');
      if (aviso?.tipo !== 'commit-guardado') throw new Error('sin commit-guardado');
      expect(aviso.mensaje).toBe('primera versión');
      expect(aviso.padre).toBeNull();
      expect(typeof aviso.autor).toBe('string');
      expect(procesoHost.salida()).toContain('acción ejecutada');

      // V4: el historial es de lectura para todos; el aviso llega también al espectador.
      await esperarQue(() => beto.mensajesDeSala.some((m) => m.tipo === 'commit-guardado'), 10_000);
      expect(beto.mensajesDeSala.some((m) => m.tipo === 'commit-guardado')).toBe(true);
    },
    30_000,
  );
});
