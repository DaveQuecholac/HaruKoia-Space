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
 *   - Un rechazo temporal después de haber estado dentro (el host está
 *     volviendo): se sigue intentando, sin tope, con "Esperando al host…".
 *     Al volver el host, entra sola (H3, E4).
 *   - Un rechazo definitivo, o cualquier rechazo en la primera entrada:
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
  comoIdentificadorDeCommit,
  esRol,
  interpretarMensajeDeSala,
  serializarMensajeDeSala,
} from '@harukoia/domain';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

import type { Invitacion } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { abrirLogLocal } from '../log-local/log-local.ts';

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

/** Commit anunciado por el host en esta sesión (V3). */
export type CommitVisible = {
  readonly id: string;
  readonly mensaje: string;
  readonly autor: string;
  readonly creadoEn: number;
  readonly padre: string | null;
};

/** Estado de push de una publicación (H5 / P8). */
export type EstadoDePushVisible = {
  readonly documento: string;
  readonly commit: string;
  readonly estadoTipo: 'en-proceso' | 'publicado' | 'fallido';
  readonly causa: string | null;
  readonly marca: number | null;
};

export type InstantaneaDeLaSala = {
  readonly estado: EstadoDeLaSala;
  readonly participantes: readonly ParticipanteVisible[];
  /** El rol que el host le dio a esta conexión. Sin decidir hasta que lo dice. */
  readonly miRol: Rol | undefined;
  /** La última acción que el host no aceptó, hasta que otra salga bien. */
  readonly accionRechazada: AccionRechazada | undefined;
  /**
   * Historial de versiones (V4).
   * Llega completo al conectar (`historial`) y crece con cada `commit-guardado`.
   */
  readonly commits: readonly CommitVisible[];
  /** Commit del estado de trabajo actual (V5). El próximo guardado cuelga de él. */
  readonly tipDeTrabajo: string | null;
  /** Estados de publicación por commit (H5 / P8). */
  readonly estadosDePush: readonly EstadoDePushVisible[];
};

export type CursorDePresencia = { readonly x: number; readonly y: number };

/**
 * El canal de presencia que ya usa el nombre. El lienzo le agrega cursor,
 * selección y página sin reemplazar el resto del estado.
 */
export type PresenciaDelLienzo = {
  readonly propio: number;
  publicar(cursor: CursorDePresencia | null, seleccion: readonly string[], pagina: string): void;
  alCambiar(oyente: (estados: ReadonlyMap<number, Record<string, unknown>>) => void): () => void;
};

export type ConexionALaSala = {
  /** El documento de esta sala. El lienzo escribe ahí; esta conexión no sabe de pizarra. */
  readonly documento: Y.Doc;
  /** Avisa cuando el documento ya recibió el estado del host, y cuando deja de estarlo. */
  alSincronizar(oyente: (sincronizado: boolean) => void): () => void;
  /** Cursor y selección junto al nombre. No crea otro canal. */
  presenciaDelLienzo(): PresenciaDelLienzo;
  /** Pide al host un link de invitación nuevo. Solo el host lo acepta. */
  cambiarInvitacion(): void;
  /** Guarda una versión de toda la pizarra. Solo el host lo acepta. */
  commitear(mensaje: string): void;
  /** Vuelve el tablero a un commit. Solo el host lo acepta. */
  hacerCheckout(id: string): void;
  /** Publica un commit al repo (markdown + git push). Solo el host. */
  publicar(id: string): void;
  /** Reintenta una publicación fallida del mismo commit. Solo el host. */
  reintentarPublicacion(id: string): void;
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
  /** Este navegador no pudo abrir el log local del documento. */
  readonly alNoGuardarElLog?: () => void;
};

/** Estados en los que ya no se reintenta. */
function esFinal(estado: EstadoDeLaSala): boolean {
  return estado.tipo === 'rechazada' || estado.tipo === 'cerrada' || estado.tipo === 'sin-host';
}

export function conectarALaSala(opciones: OpcionesDeLaConexion): ConexionALaSala {
  const { invitacion } = opciones;
  let estado: EstadoDeLaSala = { tipo: 'conectando' };
  let miRol: Rol | undefined;
  let accionRechazada: AccionRechazada | undefined;
  let commits: CommitVisible[] = [];
  let tipDeTrabajo: string | null = null;
  let estadosDePush: EstadoDePushVisible[] = [];
  let yaConecto = false;

  function fusionarEstadoDePush(entrada: EstadoDePushVisible): void {
    const resto = estadosDePush.filter((e) => e.commit !== entrada.commit);
    estadosDePush = [...resto, entrada];
  }

  function detener(final: EstadoDeLaSala): void {
    estado = final;
    websocket.disconnect();
    emitir();
  }

  function esperarAlHost(): void {
    estado = { tipo: 'esperando-al-host' };
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

  const documento = new Y.Doc();
  const logLocal = abrirLogLocal(invitacion.sala, documento, () => opciones.alNoGuardarElLog?.());
  const proveedor = new HocuspocusProvider({
    websocketProvider: websocket,
    name: invitacion.sala,
    document: documento,
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
      } else if (mensaje.tipo === 'historial') {
        commits = mensaje.commits.map((c) => ({
          id: c.id,
          mensaje: c.mensaje,
          autor: c.autor,
          creadoEn: c.creadoEn,
          padre: c.padre,
        }));
        tipDeTrabajo = mensaje.tip;
        estadosDePush = mensaje.estadosDePush.map((e) => ({
          documento: e.documento,
          commit: e.commit,
          estadoTipo: e.estadoTipo,
          causa: e.causa,
          marca: e.marca,
        }));
      } else if (mensaje.tipo === 'commit-guardado') {
        accionRechazada = undefined;
        if (!commits.some((c) => c.id === mensaje.id)) {
          commits.push({
            id: mensaje.id,
            mensaje: mensaje.mensaje,
            autor: mensaje.autor,
            creadoEn: mensaje.creadoEn,
            padre: mensaje.padre,
          });
        }
        tipDeTrabajo = mensaje.id;
      } else if (mensaje.tipo === 'checkout-hecho') {
        accionRechazada = undefined;
        tipDeTrabajo = mensaje.id;
      } else if (mensaje.tipo === 'estado-de-push') {
        accionRechazada = undefined;
        fusionarEstadoDePush({
          documento: mensaje.documento,
          commit: mensaje.commit,
          estadoTipo: mensaje.estadoTipo,
          causa: mensaje.causa,
          marca: mensaje.marca,
        });
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
    opciones.alCambiar({
      estado,
      participantes: participantes(),
      miRol,
      accionRechazada,
      commits: [...commits],
      tipDeTrabajo,
      estadosDePush: [...estadosDePush],
    });
  }

  emitir();

  return {
    documento,
    alSincronizar(oyente) {
      const avisar = ({ state }: { state: boolean }) => oyente(state);
      proveedor.on('synced', avisar);
      if (proveedor.synced) oyente(true);
      return () => proveedor.off('synced', avisar);
    },
    presenciaDelLienzo() {
      const awareness = proveedor.awareness;
      if (!awareness) throw new Error('la conexión no tiene presencia');
      return {
        propio: awareness.clientID,
        publicar(cursor, seleccion, pagina) {
          const actual = awareness.getLocalState() ?? {};
          if (
            JSON.stringify(actual.cursor) === JSON.stringify(cursor) &&
            JSON.stringify(actual.seleccion) === JSON.stringify(seleccion) &&
            actual.pagina === pagina
          ) {
            return;
          }
          awareness.setLocalState({ ...actual, cursor, seleccion, pagina });
        },
        alCambiar(oyente) {
          const avisar = () => {
            oyente(awareness.getStates() as ReadonlyMap<number, Record<string, unknown>>);
          };
          awareness.on('change', avisar);
          avisar();
          return () => awareness.off('change', avisar);
        },
      };
    },
    cambiarInvitacion() {
      accionRechazada = undefined;
      proveedor.sendStateless(serializarMensajeDeSala({ tipo: 'pedir-accion', accion: 'cambiar-invitacion' }));
      emitir();
    },
    commitear(mensaje) {
      accionRechazada = undefined;
      proveedor.sendStateless(
        serializarMensajeDeSala({ tipo: 'pedir-accion', accion: 'commitear', mensaje }),
      );
      emitir();
    },
    hacerCheckout(id) {
      accionRechazada = undefined;
      proveedor.sendStateless(
        serializarMensajeDeSala({
          tipo: 'pedir-accion',
          accion: 'hacer-checkout',
          id: comoIdentificadorDeCommit(id),
        }),
      );
      emitir();
    },
    publicar(id) {
      accionRechazada = undefined;
      proveedor.sendStateless(
        serializarMensajeDeSala({
          tipo: 'pedir-accion',
          accion: 'publicar',
          id: comoIdentificadorDeCommit(id),
        }),
      );
      emitir();
    },
    reintentarPublicacion(id) {
      accionRechazada = undefined;
      proveedor.sendStateless(
        serializarMensajeDeSala({
          tipo: 'pedir-accion',
          accion: 'reintentar-publicacion',
          id: comoIdentificadorDeCommit(id),
        }),
      );
      emitir();
    },
    salir() {
      logLocal.cerrar();
      proveedor.destroy();
      websocket.destroy();
    },
  };
}
