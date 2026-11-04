/**
 * Socket del relay: lado invitado del túnel. Fijado en el paso B5.
 *
 * Por fuera se comporta como un WebSocket normal, para que el proveedor de la
 * sala lo use sin saber del túnel. Por dentro, antes de declararse abierto,
 * hace la entrada de B3: presenta sala y token en su primer mensaje y espera
 * `entrada-aceptada`. Desde ahí solo pasa bytes, en los dos sentidos.
 *
 * Usa el `WebSocket` nativo, que existe igual en el navegador y en Node ≥ 22:
 * la web y las pruebas comparten este mismo archivo.
 *
 * El proveedor de Hocuspocus lo recibe como su clase de WebSocket
 * (`WebSocketPolyfill`) y solo toca `binaryType`, `readyState`, `send`,
 * `close` y los eventos `open`, `message`, `close` y `error`.
 */

import {
  type CausaDeCierre,
  type CausaDeRechazo,
  type IdentificadorDeSala,
  type TokenDeInvitacion,
  RUTAS,
  causaDelCierreDeSala,
  interpretarControl,
  serializarControl,
  urlDelRelay,
} from '@harukoia/domain';

/** Lo que el invitado necesita para entrar. Viene de su link de invitación. */
export type EntradaALaSala = {
  readonly sala: IdentificadorDeSala;
  readonly tokenDeInvitacion: TokenDeInvitacion;
  /** Para mostrar la causa. El proveedor solo ve un cierre con `CIERRE_POR_RECHAZO`. */
  readonly alSerRechazado?: (causa: CausaDeRechazoDeEntrada) => void;
  /**
   * Ya dentro, el host cerró la sala a propósito (B7). Distinto de una caída:
   * reintentar no la va a traer de vuelta.
   */
  readonly alCerrarseLaSala?: (causa: CausaDeCierre) => void;
};

/** Las del orquestador, más una respuesta que no es control válido. */
export type CausaDeRechazoDeEntrada = CausaDeRechazo | 'respuesta-inesperada';

/** Código de cierre que ve el proveedor cuando no se pudo entrar. Rango de aplicación (4000–4999). */
export const CIERRE_POR_RECHAZO = 4403;

const CONNECTING = 0;
const OPEN = 1;
const CLOSING = 2;
const CLOSED = 3;

export class SocketDelRelay extends EventTarget {
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSING = CLOSING;
  static readonly CLOSED = CLOSED;

  readonly url: string;
  binaryType: 'arraybuffer' | 'blob' = 'arraybuffer';
  readyState: number = CONNECTING;

  readonly #socket: WebSocket;
  #causaDelRechazo: CausaDeRechazoDeEntrada | undefined;

  constructor(base: string, entrada: EntradaALaSala) {
    super();
    this.url = base;

    const socket = new WebSocket(urlDelRelay(base, RUTAS.invitado));
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => {
      socket.send(
        serializarControl({
          tipo: 'entrar',
          sala: entrada.sala,
          tokenDeInvitacion: entrada.tokenDeInvitacion,
        }),
      );
    });

    socket.addEventListener('message', (evento) => {
      if (this.readyState === OPEN) {
        this.dispatchEvent(Object.assign(new Event('message'), { data: evento.data }));
        return;
      }
      if (this.readyState !== CONNECTING) return;

      // Antes de abrirse, el único mensaje posible es la respuesta de control.
      const leido = typeof evento.data === 'string' ? interpretarControl(evento.data) : undefined;
      const mensaje = leido?.ok ? leido.mensaje : undefined;

      if (mensaje?.tipo === 'entrada-aceptada') {
        this.readyState = OPEN;
        this.dispatchEvent(new Event('open'));
        return;
      }

      const causa = mensaje?.tipo === 'entrada-rechazada' ? mensaje.causa : 'respuesta-inesperada';
      this.#causaDelRechazo = causa;
      entrada.alSerRechazado?.(causa);
      this.readyState = CLOSING;
      socket.close(1000);
    });

    socket.addEventListener('error', () => {
      this.dispatchEvent(new Event('error'));
    });

    socket.addEventListener('close', (evento) => {
      const estabaDentro = this.readyState === OPEN;
      this.readyState = CLOSED;

      const causaDelCierre = estabaDentro ? causaDelCierreDeSala(evento.code, evento.reason) : undefined;
      if (causaDelCierre !== undefined) entrada.alCerrarseLaSala?.(causaDelCierre);

      const causa = this.#causaDelRechazo;
      this.dispatchEvent(
        Object.assign(new Event('close'), {
          code: causa ? CIERRE_POR_RECHAZO : evento.code,
          reason: causa ?? evento.reason,
          wasClean: evento.wasClean,
        }),
      );
    });
  }

  send(datos: string | ArrayBufferLike | ArrayBufferView | Blob): void {
    if (this.readyState === CONNECTING) {
      throw new DOMException('el socket del relay todavía no entra a la sala', 'InvalidStateError');
    }
    if (this.readyState !== OPEN) return;
    this.#socket.send(datos as Parameters<WebSocket['send']>[0]);
  }

  close(codigo?: number, razon?: string): void {
    if (this.readyState === CLOSING || this.readyState === CLOSED) return;
    this.readyState = CLOSING;
    this.#socket.close(codigo, razon);
  }
}

/**
 * La clase que se le pasa al proveedor. El proveedor construye el socket con
 * una sola URL, así que la entrada a la sala queda fijada aquí.
 */
export function claseDelSocketDelRelay(entrada: EntradaALaSala): new (base: string) => SocketDelRelay {
  return class extends SocketDelRelay {
    constructor(base: string) {
      super(base, entrada);
    }
  };
}
