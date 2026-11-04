/**
 * Proxy TCP para estropear la red entre un invitado y el orquestador. Fijado
 * en el paso B7, decisión 4: dentro de las pruebas, sin dependencias.
 *
 * Se pone delante de un puerto y reenvía cada conexión, con tres averías:
 *
 *   - **latencia**: cada trozo espera antes de reenviarse, en orden;
 *   - **partir**: deja de reenviar y guarda lo que llega, como un cable
 *     desenchufado. TCP no pierde bytes: al **unir**, todo sigue donde iba;
 *   - **cortar**: destruye las conexiones abiertas, como un router que se
 *     reinicia. Las nuevas pasan.
 */

import { type Server, type Socket, connect, createServer } from 'node:net';

export type ProxyDeRed = {
  readonly puerto: number;
  latencia(milisegundos: number): void;
  partir(): void;
  unir(): void;
  cortar(): void;
  cerrar(): Promise<void>;
};

type Sentido = { readonly origen: Socket; readonly destino: Socket; readonly retenidos: Buffer[] };

export async function proxyDeRed(puertoDestino: number): Promise<ProxyDeRed> {
  let latencia = 0;
  let partido = false;
  const sentidos = new Set<Sentido>();
  const sockets = new Set<Socket>();

  function entregar(sentido: Sentido, trozo: Buffer): void {
    if (partido) {
      sentido.retenidos.push(trozo);
      return;
    }
    const escribir = (): void => {
      if (!sentido.destino.destroyed) sentido.destino.write(trozo);
    };
    if (latencia === 0) escribir();
    else setTimeout(escribir, latencia);
  }

  function unirSentido(origen: Socket, destino: Socket): void {
    const sentido: Sentido = { origen, destino, retenidos: [] };
    sentidos.add(sentido);
    origen.on('data', (trozo: Buffer) => entregar(sentido, trozo));
    origen.on('close', () => {
      sentidos.delete(sentido);
      destino.destroy();
    });
    origen.on('error', () => destino.destroy());
  }

  const servidor: Server = createServer((cliente) => {
    const servidorDestino = connect(puertoDestino, '127.0.0.1');
    for (const socket of [cliente, servidorDestino]) {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    }
    unirSentido(cliente, servidorDestino);
    unirSentido(servidorDestino, cliente);
  });

  await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string') throw new Error('el proxy no tiene puerto');

  return {
    puerto: direccion.port,
    latencia(milisegundos) {
      latencia = milisegundos;
    },
    partir() {
      partido = true;
    },
    unir() {
      partido = false;
      for (const sentido of sentidos) {
        for (const trozo of sentido.retenidos.splice(0)) entregar(sentido, trozo);
      }
    },
    cortar() {
      for (const socket of sockets) socket.destroy();
    },
    cerrar() {
      for (const socket of sockets) socket.destroy();
      return new Promise((listo) => servidor.close(() => listo()));
    },
  };
}
