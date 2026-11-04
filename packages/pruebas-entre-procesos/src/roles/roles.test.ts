/**
 * Verificación del paso B8 con los procesos reales: el rol lo decide el host,
 * una acción de host mandada a mano por un espectador se rechaza, y nadie
 * puede ponerse rol de host ni hablar a nombre de otro en la presencia.
 *
 * Los espectadores mandan la petición con el mensaje del contrato, sin ninguna
 * interfaz de por medio: es "la petición hecha a mano" del criterio 2.
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

describe('roles mínimos', () => {
  it(
    'el host decide los roles y los sella en la presencia, aunque el cliente diga otra cosa',
    async () => {
      const { base, sala, token, tokenDeWebDelHost } = await salaLevantada();
      const host = entrar({ base, sala, token, nombre: 'hector', tokenDeWebDelHost });
      const beto = entrar({ base, sala, token, nombre: 'beto' });

      await esperarQue(() => rolRecibido(host) === 'host');
      await esperarQue(() => rolRecibido(beto) === 'espectador');

      // Beto se declara host en su propia presencia: los demás lo ven espectador.
      beto.proveedor.setAwarenessField('rol', 'host');
      await esperarQue(() => host.rolVistoDe('beto') === 'espectador');
      await esperarQue(() => beto.rolVistoDe('hector') === 'host');
      await new Promise((listo) => setTimeout(listo, 300));
      expect(host.rolVistoDe('beto')).toBe('espectador');
    },
    30_000,
  );

  it(
    'un espectador pide a mano cambiar el link: se rechaza y el link sigue sirviendo',
    async () => {
      const { base, host: procesoHost, sala, token } = await salaLevantada();
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => rolRecibido(beto) === 'espectador');

      beto.pedirAccion('cambiar-invitacion');

      await esperarQue(() => beto.mensajesDeSala.some((m) => m.tipo === 'accion-rechazada'));
      expect(beto.mensajesDeSala).toContainEqual({
        tipo: 'accion-rechazada',
        accion: 'cambiar-invitacion',
        causa: 'rol-insuficiente',
      });
      expect(procesoHost.salida()).toContain('acción rechazada');

      // El link original sigue entrando.
      const carla = entrar({ base, sala, token, nombre: 'carla' });
      await esperarQue(() => carla.conectado() && rolRecibido(carla) === 'espectador');
    },
    30_000,
  );

  it(
    'el host cambia el link: el anterior deja de entrar, quien estaba sigue dentro y solo el host recibe el nuevo',
    async () => {
      const { base, host: procesoHost, sala, token, tokenDeWebDelHost } = await salaLevantada();
      const host = entrar({ base, sala, token, nombre: 'hector', tokenDeWebDelHost });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => rolRecibido(host) === 'host' && rolRecibido(beto) === 'espectador');

      host.pedirAccion('cambiar-invitacion');
      await esperarQue(() => host.mensajesDeSala.some((m) => m.tipo === 'invitacion-cambiada'), 10_000);
      const aviso = host.mensajesDeSala.find((m) => m.tipo === 'invitacion-cambiada');
      if (aviso?.tipo !== 'invitacion-cambiada') throw new Error('sin aviso de invitación cambiada');
      expect(aviso.tokenDeInvitacion).not.toBe(token);

      // El espectador no recibe el token nuevo.
      await new Promise((listo) => setTimeout(listo, 300));
      expect(beto.mensajesDeSala.some((m) => m.tipo === 'invitacion-cambiada')).toBe(false);

      // Quien estaba sigue dentro y sincronizando.
      host.documento.getMap('prueba').set('despues', true);
      await esperarQue(() => beto.documento.getMap('prueba').get('despues') === true);

      // El link anterior ya no entra; el nuevo sí.
      const conViejo = entrar({ base, sala, token, nombre: 'tarde' });
      await new Promise((listo) => setTimeout(listo, 1_500));
      expect(conViejo.conexiones()).toBe(0);
      const conNuevo = entrar({ base, sala, token: aviso.tokenDeInvitacion, nombre: 'nueva' });
      await esperarQue(() => conNuevo.conectado());

      // Y la web de la máquina recibe ya el vigente.
      expect((await invitacionParaLaWeb(procesoHost)).token).toBe(aviso.tokenDeInvitacion);
    },
    40_000,
  );

  it(
    'un espectador no puede hablar a nombre de otro participante',
    async () => {
      const { base, sala, token, tokenDeWebDelHost } = await salaLevantada();
      const host = entrar({ base, sala, token, nombre: 'hector', tokenDeWebDelHost });
      const beto = entrar({ base, sala, token, nombre: 'beto' });
      await esperarQue(() => beto.rolVistoDe('hector') === 'host');

      // Un intruso con el mismo identificador de presencia que el host.
      const intruso = entrar({
        base,
        sala,
        token,
        nombre: 'hector-falso',
        clienteDePresencia: host.documento.clientID,
      });
      await esperarQue(() => rolRecibido(intruso) === 'espectador');

      // Yjs descarta una presencia con un contador menor al que ya conoce. Un
      // atacante lo sube a propósito para que la suya gane.
      for (let i = 0; i < 50; i++) intruso.proveedor.setAwarenessField('intento', i);
      await new Promise((listo) => setTimeout(listo, 1_000));

      expect(beto.nombresPresentes()).not.toContain('hector-falso');
      expect(beto.rolVistoDe('hector')).toBe('host');
    },
    30_000,
  );
});
