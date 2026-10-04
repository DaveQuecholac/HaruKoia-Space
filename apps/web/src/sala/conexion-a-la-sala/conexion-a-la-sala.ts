/**
 * Conexión de la web a una sala. Fijado en B6.
 *
 * Proveedor de Hocuspocus sobre el socket del relay: el mismo camino que
 * probaron los invitados sin navegador en B5. Esta pieza no sabe de pizarra;
 * H2 agrega el lienzo sobre el mismo documento.
 *
 * Un rechazo de entrada **detiene** los reintentos: el proveedor reintentaría
 * para siempre un link inválido o una sala que ya no existe. La causa se
 * muestra. Volver a intentar es una decisión de la persona.
 */

import { type CausaDeRechazoDeEntrada, claseDelSocketDelRelay } from '@harukoia/cliente-del-relay';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

import type { Invitacion } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { type Rol, esRol } from '../../host/rol-en-la-pestana/rol-en-la-pestana.ts';

export type EstadoDeLaSala =
  | { readonly tipo: 'conectando' }
  | { readonly tipo: 'conectada' }
  | { readonly tipo: 'reconectando' }
  | { readonly tipo: 'rechazada'; readonly causa: CausaDeRechazoDeEntrada };

export type ParticipanteVisible = {
  readonly cliente: number;
  readonly nombre: string | undefined;
  readonly rol: Rol | undefined;
  readonly soyYo: boolean;
};

export type InstantaneaDeLaSala = {
  readonly estado: EstadoDeLaSala;
  readonly participantes: readonly ParticipanteVisible[];
};

export type OpcionesDeLaConexion = {
  readonly orquestador: string;
  readonly invitacion: Invitacion;
  readonly nombre: string;
  readonly rol: Rol;
  readonly alCambiar: (instantanea: InstantaneaDeLaSala) => void;
};

export function conectarALaSala(opciones: OpcionesDeLaConexion): { salir(): void } {
  const { invitacion } = opciones;
  let estado: EstadoDeLaSala = { tipo: 'conectando' };
  let yaConecto = false;

  const websocket = new HocuspocusProviderWebsocket({
    url: opciones.orquestador,
    WebSocketPolyfill: claseDelSocketDelRelay({
      sala: invitacion.sala,
      tokenDeInvitacion: invitacion.tokenDeInvitacion,
      alSerRechazado: (causa) => {
        estado = { tipo: 'rechazada', causa };
        websocket.disconnect();
        emitir();
      },
    }),
  });

  const proveedor = new HocuspocusProvider({
    websocketProvider: websocket,
    name: invitacion.sala,
    document: new Y.Doc(),
  });
  // Con un socket propio, el proveedor no se engancha solo.
  proveedor.attach();
  proveedor.setAwarenessField('nombre', opciones.nombre);
  proveedor.setAwarenessField('rol', opciones.rol);

  websocket.on('status', ({ status }: { status: string }) => {
    if (estado.tipo === 'rechazada') return;
    if (status === 'connected') {
      yaConecto = true;
      estado = { tipo: 'conectada' };
    } else {
      estado = { tipo: yaConecto ? 'reconectando' : 'conectando' };
    }
    emitir();
  });

  proveedor.awareness?.on('change', emitir);

  function participantes(): ParticipanteVisible[] {
    const presencia = proveedor.awareness;
    if (!presencia) return [];
    return [...presencia.getStates()]
      .map(([cliente, datos]) => ({
        cliente,
        nombre: typeof datos.nombre === 'string' ? datos.nombre : undefined,
        rol: esRol(datos.rol) ? datos.rol : undefined,
        soyYo: cliente === presencia.clientID,
      }))
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '') || a.cliente - b.cliente);
  }

  function emitir(): void {
    opciones.alCambiar({ estado, participantes: participantes() });
  }

  emitir();

  return {
    salir() {
      proveedor.destroy();
      websocket.destroy();
    },
  };
}
