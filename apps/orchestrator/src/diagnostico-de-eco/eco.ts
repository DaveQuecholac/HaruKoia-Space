import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';

import type { Registro } from '@harukoia/registro';
import { WebSocketServer } from 'ws';

/**
 * Prueba de humo del paso A3: confirma que una conexión WebSocket sobrevive al
 * proxy de desarrollo antes de construir el relay encima. Se retira en B3,
 * cuando el túnel tome la ruta de actualización de protocolo.
 */
export const RUTA_DE_ECO = '/diagnostico/eco';

export function montarEcoDeDiagnostico(servidor: Server, registro: Registro): void {
  const servidorDeSockets = new WebSocketServer({ noServer: true });
  let conexionesAbiertas = 0;

  servidor.on('upgrade', (peticion: IncomingMessage, socket: Duplex, cabecera: Buffer) => {
    const ruta = new URL(peticion.url ?? '/', 'http://interno').pathname;

    if (ruta !== RUTA_DE_ECO) {
      registro.aviso('actualización rechazada: ruta desconocida', { ruta });
      socket.destroy();
      return;
    }

    servidorDeSockets.handleUpgrade(peticion, socket, cabecera, (conexion) => {
      servidorDeSockets.emit('connection', conexion, peticion);
    });
  });

  servidorDeSockets.on('connection', (conexion) => {
    conexionesAbiertas += 1;
    const registroDeLaConexion = registro.con({ conexion: conexionesAbiertas });

    registroDeLaConexion.info('eco: conexión abierta', { activas: servidorDeSockets.clients.size });

    conexion.on('message', (datos, esBinario) => {
      conexion.send(datos, { binary: esBinario });
    });

    conexion.on('close', (codigo) => {
      registroDeLaConexion.info('eco: conexión cerrada', { codigo });
    });
  });
}
