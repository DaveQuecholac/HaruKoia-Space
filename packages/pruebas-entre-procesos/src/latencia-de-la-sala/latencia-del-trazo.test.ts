/**
 * Latencia de un trazo (C6): dos clientes Yjs sin navegador, por el relay.
 *
 * El valor es un registro del mapa `tablero`, el mismo sitio donde el lienzo
 * escribe. No reprueba por el número: la máquina manda. Falla solo si no llega.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { ORIGEN_DE_LA_WEB_DE_PRUEBA, invitacionDelHost, registroDeLaSala } from '../invitacion-del-host/invitacion-del-host.ts';
import { apagarTodos, esperarQue, levantar, puertoLibre } from '../levantar-proceso/levantar-proceso.ts';
import { type InvitadoDeLaSala, invitadoDeLaSala } from '../sala-en-vivo/invitado-de-la-sala.ts';
import { medirLatencia, resumenDeLatencia } from './latencia-de-la-sala.ts';

const RONDAS = 5;

/** Un registro, en texto, como lo guarda el lienzo. No es una forma de tldraw importada. */
const TRAZO = JSON.stringify({
  id: 'shape:trazo',
  typeName: 'shape',
  x: 10,
  y: 20,
});

const invitados: InvitadoDeLaSala[] = [];

afterAll(async () => {
  for (const invitado of invitados.splice(0)) invitado.salir();
  await apagarTodos();
});

describe('latencia de un trazo', () => {
  it(
    'cruza el relay hasta el otro cliente',
    async () => {
      const puerto = await puertoLibre();
      const base = `ws://127.0.0.1:${puerto}`;
      const orquestador = await levantar('apps/orchestrator/src/main.ts', { PORT: String(puerto) });
      const host = await levantar('apps/host/src/main.ts', {
        ORQUESTADOR_URL: base,
        WEB_ORIGEN: ORIGEN_DE_LA_WEB_DE_PRUEBA,
      });
      const { sala, token } = await invitacionDelHost(host);
      await esperarQue(() => registroDeLaSala(orquestador, sala));

      const quienDibuja = invitadoDeLaSala({ base, sala, token, nombre: 'quien-dibuja' });
      const quienMira = invitadoDeLaSala({ base, sala, token, nombre: 'quien-mira' });
      invitados.push(quienDibuja, quienMira);

      await esperarQue(
        () => quienDibuja.nombresPresentes().join() === 'quien-dibuja,quien-mira' && quienMira.conectado(),
        30_000,
      );

      const medicion = await medirLatencia({
        escritor: quienDibuja.documento,
        observadores: [quienMira.documento],
        rondas: RONDAS,
        mapa: 'tablero',
        valor: () => TRAZO,
      });

      expect(medicion.rondas).toHaveLength(RONDAS);
      expect(quienMira.documento.getMap('tablero').get('ronda-0')).toBe(TRAZO);
      console.log(resumenDeLatencia(medicion, 2));
    },
    120_000,
  );
});
