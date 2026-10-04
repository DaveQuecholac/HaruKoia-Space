import { claseDelSocketDelRelay } from '@harukoia/cliente-del-relay';
import type { IdentificadorDeSala, TokenDeInvitacion } from '@harukoia/domain';
import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import * as Y from 'yjs';

export type InvitadoDeLaSala = {
  readonly documento: Y.Doc;
  readonly proveedor: HocuspocusProvider;
  /** Los nombres que este invitado ve en la presencia, el suyo incluido. */
  nombresPresentes(): string[];
  salir(): void;
};

/**
 * Un invitado sin navegador, con el mismo proveedor y el mismo socket del
 * relay que usará la web. `documento` es el nombre que pide al host: el de la
 * sala, salvo en la prueba de un documento ajeno.
 */
export function invitadoDeLaSala(opciones: {
  readonly base: string;
  readonly sala: IdentificadorDeSala;
  readonly token: TokenDeInvitacion;
  readonly nombre: string;
  readonly documento?: string;
}): InvitadoDeLaSala {
  const documento = new Y.Doc();
  const websocket = new HocuspocusProviderWebsocket({
    url: opciones.base,
    WebSocketPolyfill: claseDelSocketDelRelay({ sala: opciones.sala, tokenDeInvitacion: opciones.token }),
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
