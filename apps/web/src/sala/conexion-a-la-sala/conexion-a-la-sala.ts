/**
 * Conexión de la web a una sala. Fijado en B6, con la resistencia de B7.
 *
 * Proveedor de Hocuspocus sobre el socket del relay: el mismo camino que
 * probaron los invitados sin navegador en B5. Esta pieza no sabe de pizarra;
 * H2 agrega el lienzo sobre el mismo documento.
 *
 * Qué pasa cuando algo falla (B7, decisiones 1 y 2):
 *
 *   - Una caída de red o del orquestador: el proveedor reintenta solo, con
 *     espera creciente, sin límite. La persona ve "Reconectando…".
 *   - Un rechazo **temporal** después de haber estado dentro (el host está
 *     volviendo): se sigue intentando hasta `ESPERA_MAXIMA_DEL_HOST`, con
 *     "Esperando al host…". Al vencer, "La sala se cerró" y Reintentar.
 *   - Un rechazo **definitivo**, o cualquier rechazo en la primera entrada:
 *     se detiene y se muestra la causa. Reintentar es decisión de la persona.
 *   - El host cerró la sala a propósito: se detiene. No hay a qué volver.
 *
 * Roles (B8): la pestaña del host presenta su token al conectar; el host
 * decide el rol, se lo dice a esta conexión (`tu-rol`) y lo sella en la
 * presencia de cada participante. La web no anuncia su propio rol.
 */

import {
  type CausaDeRechazoDeEntrada,
  claseDelSocketDelRelay,
  naturalezaDelRechazo,
} from '@harukoia/cliente-del-relay';
import {
  type AccionDeSala,
  type CausaDeAccionRechazada,
  type CausaDeCierre,
  type Rol,
  type TokenDeInvitacion,
  type TokenDeWebDelHost,
  esRol,
  interpretarMensajeDeSala,
  serializarMensajeDeSala,
} from '@harukoia/domain';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

import type { Invitacion } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';

/** Dos minutos de espera al host antes de dar la sala por cerrada. */
export const ESPERA_MAXIMA_DEL_HOST = 120_000;

/**
 * Reintentos del proveedor, explícitos para no depender de sus valores por
 * omisión: 1 s, doblando, con tope de 30 s y algo de azar para que todos los
 * invitados no vuelvan en el mismo instante. El mismo tope que el host.
 */
const REINTENTOS = {
  delay: 1_000,
  factor: 2,
  minDelay: 1_000,
  maxDelay: 30_000,
  jitter: true,
  maxAttempts: 0,
} as const;

export type EstadoDeLaSala =
  | { readonly tipo: 'conectando' }
  | { readonly tipo: 'conectada' }
  | { readonly tipo: 'reconectando' }
  | { readonly tipo: 'esperando-al-host' }
  | { readonly tipo: 'sin-host' }
  | { readonly tipo: 'cerrada'; readonly causa: CausaDeCierre }
  | { readonly tipo: 'rechazada'; readonly causa: CausaDeRechazoDeEntrada };

export type ParticipanteVisible = {
  readonly cliente: number;
  readonly nombre: string | undefined;
  readonly rol: Rol | undefined;
  readonly soyYo: boolean;
};

export type AccionRechazada = { readonly accion: AccionDeSala; readonly causa: CausaDeAccionRechazada };

export type InstantaneaDeLaSala = {
  readonly estado: EstadoDeLaSala;
  readonly participantes: readonly ParticipanteVisible[];
  /** El rol que el host le dio a esta conexión. Sin decidir hasta que lo dice. */
  readonly miRol: Rol | undefined;
  /** La última acción que el host no aceptó, hasta que otra salga bien. */
  readonly accionRechazada: AccionRechazada | undefined;
};

export type ConexionALaSala = {
  /** Pide al host un link de invitación nuevo. Solo el host lo acepta. */
  cambiarInvitacion(): void;
  salir(): void;
};

export type OpcionesDeLaConexion = {
  readonly orquestador: string;
  readonly invitacion: Invitacion;
  readonly nombre: string;
  /** Solo la pestaña que pasó por "Volverme host" lo tiene. */
  readonly tokenDeWebDelHost: TokenDeWebDelHost | undefined;
  readonly alCambiar: (instantanea: InstantaneaDeLaSala) => void;
  /** El host cambió el link. El anterior ya no deja entrar. */
  readonly alCambiarLaInvitacion: (tokenDeInvitacion: TokenDeInvitacion) => void;
  /** Solo para pruebas. */
  readonly esperaMaximaDelHost?: number;
};

/** Estados en los que ya no se reintenta. */
function esFinal(estado: EstadoDeLaSala): boolean {
  return estado.tipo === 'rechazada' || estado.tipo === 'cerrada' || estado.tipo === 'sin-host';
}

export function conectarALaSala(opciones: OpcionesDeLaConexion): ConexionALaSala {
  const { invitacion } = opciones;
  const esperaMaxima = opciones.esperaMaximaDelHost ?? ESPERA_MAXIMA_DEL_HOST;
  let estado: EstadoDeLaSala = { tipo: 'conectando' };
  let miRol: Rol | undefined;
  let accionRechazada: AccionRechazada | undefined;
  let yaConecto = false;
  let vencimiento: ReturnType<typeof setTimeout> | undefined;

  function detener(final: EstadoDeLaSala): void {
    clearTimeout(vencimiento);
    vencimiento = undefined;
    estado = final;
    websocket.disconnect();
    emitir();
  }

  function esperarAlHost(): void {
    estado = { tipo: 'esperando-al-host' };
    vencimiento ??= setTimeout(() => detener({ tipo: 'sin-host' }), esperaMaxima);
    emitir();
  }

  const websocket = new HocuspocusProviderWebsocket({
    url: opciones.orquestador,
    ...REINTENTOS,
    WebSocketPolyfill: claseDelSocketDelRelay({
      sala: invitacion.sala,
      tokenDeInvitacion: invitacion.tokenDeInvitacion,
      alSerRechazado: (causa) => {
        if (esFinal(estado)) return;
        if (yaConecto && naturalezaDelRechazo(causa) === 'temporal') esperarAlHost();
        else detener({ tipo: 'rechazada', causa });
      },
      alCerrarseLaSala: (causa) => {
        if (esFinal(estado)) return;
        detener({ tipo: 'cerrada', causa });
      },
    }),
  });

  const proveedor = new HocuspocusProvider({
    websocketProvider: websocket,
    name: invitacion.sala,
    document: new Y.Doc(),
    ...(opciones.tokenDeWebDelHost === undefined ? {} : { token: opciones.tokenDeWebDelHost }),
    onStateless: ({ payload }) => {
      const leido = interpretarMensajeDeSala(payload);
      if (!leido.ok) return;
      const mensaje = leido.mensaje;
      if (mensaje.tipo === 'tu-rol') {
        miRol = mensaje.rol;
      } else if (mensaje.tipo === 'accion-rechazada') {
        accionRechazada = { accion: mensaje.accion, causa: mensaje.causa };
      } else if (mensaje.tipo === 'invitacion-cambiada') {
        accionRechazada = undefined;
        opciones.alCambiarLaInvitacion(mensaje.tokenDeInvitacion);
      } else {
        return;
      }
      emitir();
    },
  });
  // Con un socket propio, el proveedor no se engancha solo.
  proveedor.attach();
  proveedor.setAwarenessField('nombre', opciones.nombre);

  websocket.on('status', ({ status }: { status: string }) => {
    if (esFinal(estado)) return;
    if (status === 'connected') {
      yaConecto = true;
      clearTimeout(vencimiento);
      vencimiento = undefined;
      estado = { tipo: 'conectada' };
    } else if (estado.tipo !== 'esperando-al-host') {
      estado = { tipo: yaConecto ? 'reconectando' : 'conectando' };
    }
    emitir();
  });

  proveedor.awareness?.on('change', emitir);

  function participantes(): ParticipanteVisible[] {
    const presencia = proveedor.awareness;
    if (!presencia) return [];
    return [...presencia.getStates()]
      .map(([cliente, datos]) => {
        const soyYo = cliente === presencia.clientID;
        // El sello del host llega en la presencia de los demás; la propia es
        // local y no lo trae, por eso el rol propio sale de `tu-rol`.
        return {
          cliente,
          nombre: typeof datos.nombre === 'string' ? datos.nombre : undefined,
          rol: soyYo ? miRol : esRol(datos.rol) ? datos.rol : undefined,
          soyYo,
        };
      })
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '') || a.cliente - b.cliente);
  }

  function emitir(): void {
    opciones.alCambiar({ estado, participantes: participantes(), miRol, accionRechazada });
  }

  emitir();

  return {
    cambiarInvitacion() {
      accionRechazada = undefined;
      proveedor.sendStateless(serializarMensajeDeSala({ tipo: 'pedir-accion', accion: 'cambiar-invitacion' }));
      emitir();
    },
    salir() {
      clearTimeout(vencimiento);
      proveedor.destroy();
      websocket.destroy();
    },
  };
}
