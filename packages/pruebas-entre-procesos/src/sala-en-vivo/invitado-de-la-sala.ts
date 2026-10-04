import { claseDelSocketDelRelay } from '@harukoia/cliente-del-relay';
import {
  type AccionDeSala,
  type CausaDeCierre,
  type IdentificadorDeSala,
  type MensajeDelHostDeLaSala,
  type TokenDeInvitacion,
  type TokenDeWebDelHost,
  interpretarMensajeDeSala,
  serializarMensajeDeSala,
} from '@harukoia/domain';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

export type InvitadoDeLaSala = {
  readonly documento: Y.Doc;
  readonly proveedor: HocuspocusProvider;
  /** Los cierres de sala que recibió, en orden. Una caída no deja nada aquí. */
  readonly cierresDeSala: readonly CausaDeCierre[];
  /** Lo que el host le dijo por mensajes de sala, en orden. */
  readonly mensajesDeSala: readonly MensajeDelHostDeLaSala[];
  /** Cuántas veces quedó conectado. Más de una es que reconectó solo. */
  conexiones(): number;
  conectado(): boolean;
  /** Los nombres que este invitado ve en la presencia, el suyo incluido. */
  nombresPresentes(): string[];
  /** El rol que la presencia muestra para ese nombre, visto por este invitado. */
  rolVistoDe(nombre: string): unknown;
  /** Pide una acción con el mensaje del contrato, sin pasar por ninguna interfaz. */
  pedirAccion(accion: AccionDeSala): void;
  salir(): void;
};

/**
 * Un invitado sin navegador, con el mismo proveedor y el mismo socket del
 * relay que usará la web. `documento` es el nombre que pide al host: el de la
 * sala, salvo en la prueba de un documento ajeno.
 *
 * No tiene la política de la web ante rechazos: el proveedor reintenta
 * siempre. Eso es lo que se quiere aquí, medir que el camino vuelve solo.
 *
 * `tokenDeWebDelHost` lo vuelve la pestaña del host. `clienteDePresencia` fija
 * su identificador de Yjs, para la prueba de hablar a nombre de otro.
 */
export function invitadoDeLaSala(opciones: {
  readonly base: string;
  readonly sala: IdentificadorDeSala;
  readonly token: TokenDeInvitacion;
  readonly nombre: string;
  readonly documento?: string;
  readonly tokenDeWebDelHost?: TokenDeWebDelHost;
  readonly clienteDePresencia?: number;
}): InvitadoDeLaSala {
  const documento = new Y.Doc();
  if (opciones.clienteDePresencia !== undefined) documento.clientID = opciones.clienteDePresencia;
  const cierresDeSala: CausaDeCierre[] = [];
  const mensajesDeSala: MensajeDelHostDeLaSala[] = [];
  let conexiones = 0;

  const websocket = new HocuspocusProviderWebsocket({
    url: opciones.base,
    WebSocketPolyfill: claseDelSocketDelRelay({
      sala: opciones.sala,
      tokenDeInvitacion: opciones.token,
      alCerrarseLaSala: (causa) => cierresDeSala.push(causa),
    }),
  });
  // El proveedor puede repetir el mismo estado: se cuentan las transiciones.
  let ultimo = '';
  websocket.on('status', ({ status }: { status: string }) => {
    if (status === 'connected' && ultimo !== 'connected') conexiones++;
    ultimo = status;
  });

  const proveedor = new HocuspocusProvider({
    websocketProvider: websocket,
    name: opciones.documento ?? opciones.sala,
    document: documento,
    ...(opciones.tokenDeWebDelHost === undefined ? {} : { token: opciones.tokenDeWebDelHost }),
    onStateless: ({ payload }) => {
      const leido = interpretarMensajeDeSala(payload);
      if (leido.ok && leido.mensaje.tipo !== 'pedir-accion') mensajesDeSala.push(leido.mensaje);
    },
  });
  // Con un socket propio, el proveedor no se engancha solo.
  proveedor.attach();
  proveedor.setAwarenessField('nombre', opciones.nombre);

  function estados(): Map<number, Record<string, unknown>> {
    return proveedor.awareness?.getStates() ?? new Map();
  }

  return {
    documento,
    proveedor,
    cierresDeSala,
    mensajesDeSala,
    conexiones: () => conexiones,
    conectado: () => ultimo === 'connected',
    nombresPresentes() {
      return [...estados().values()].map((estado) => String(estado.nombre)).sort();
    },
    rolVistoDe(nombre) {
      return [...estados().values()].find((estado) => estado.nombre === nombre)?.rol;
    },
    pedirAccion(accion) {
      proveedor.sendStateless(serializarMensajeDeSala({ tipo: 'pedir-accion', accion }));
    },
    salir() {
      proveedor.destroy();
      websocket.destroy();
    },
  };
}
