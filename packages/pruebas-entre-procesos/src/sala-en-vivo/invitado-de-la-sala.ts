import { claseDelSocketDelRelay } from '@harukoia/cliente-del-relay';
import type { CausaDeCierre, IdentificadorDeSala, TokenDeInvitacion } from '@harukoia/domain';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

export type InvitadoDeLaSala = {
  readonly documento: Y.Doc;
  readonly proveedor: HocuspocusProvider;
  /** Los cierres de sala que recibió, en orden. Una caída no deja nada aquí. */
  readonly cierresDeSala: readonly CausaDeCierre[];
  /** Cuántas veces quedó conectado. Más de una es que reconectó solo. */
  conexiones(): number;
  conectado(): boolean;
  /** Los nombres que este invitado ve en la presencia, el suyo incluido. */
  nombresPresentes(): string[];
  salir(): void;
};

/**
 * Un invitado sin navegador, con el mismo proveedor y el mismo socket del
 * relay que usará la web. `documento` es el nombre que pide al host: el de la
 * sala, salvo en la prueba de un documento ajeno.
 *
 * No tiene la política de la web ante rechazos: el proveedor reintenta
 * siempre. Eso es lo que se quiere aquí, medir que el camino vuelve solo.
 */
export function invitadoDeLaSala(opciones: {
  readonly base: string;
  readonly sala: IdentificadorDeSala;
  readonly token: TokenDeInvitacion;
  readonly nombre: string;
  readonly documento?: string;
}): InvitadoDeLaSala {
  const documento = new Y.Doc();
  const cierresDeSala: CausaDeCierre[] = [];
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
  });
  // Con un socket propio, el proveedor no se engancha solo.
  proveedor.attach();
  proveedor.setAwarenessField('nombre', opciones.nombre);

  return {
    documento,
    proveedor,
    cierresDeSala,
    conexiones: () => conexiones,
    conectado: () => ultimo === 'connected',
    nombresPresentes() {
      const estados = proveedor.awareness?.getStates() ?? new Map();
      return [...estados.values()].map((estado) => String(estado.nombre)).sort();
    },
    salir() {
      proveedor.destroy();
      websocket.destroy();
    },
  };
}
