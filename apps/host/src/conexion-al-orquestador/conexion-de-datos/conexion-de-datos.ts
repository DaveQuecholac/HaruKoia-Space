/**
 * Conexión de datos del host: la que abre **hacia fuera** cuando el
 * orquestador avisa que llegó un invitado. Fijado en el paso B4, con D3.
 *
 * Este archivo no sabe qué viaja por ella. Empareja con el ticket, espera la
 * confirmación y entrega el socket al manejador de su canal. Lo que pase
 * después —la sala en vivo de B5, la réplica de más adelante— lo decide ese
 * manejador. Un canal nuevo es un miembro de `CANALES` y su manejador: aquí no
 * se cambia nada.
 */

import {
  type Canal,
  type IdentificadorDeConexion,
  type MensajeDelOrquestador,
  RUTAS,
  interpretarControl,
  serializarControl,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';
import { WebSocket } from 'ws';

import { urlDelRelay } from '../url-del-relay/url-del-relay.ts';

/** Lo que recibe un manejador: el socket ya emparejado, solo con bytes. */
export type ConexionDeDatos = {
  readonly conexion: IdentificadorDeConexion;
  readonly canal: Canal;
  readonly socket: WebSocket;
  readonly registro: Registro;
};

export type ManejadorDeCanal = (datos: ConexionDeDatos) => void;

/** Un manejador por canal. `Record` para que un canal nuevo no compile sin el suyo. */
export type ManejadoresDeCanal = Readonly<Record<Canal, ManejadorDeCanal>>;

type AvisoDeInvitado = Extract<MensajeDelOrquestador, { tipo: 'entra-invitado' }>;

export type OpcionesDeConexionDeDatos = {
  readonly base: string;
  readonly aviso: AvisoDeInvitado;
  readonly manejadores: ManejadoresDeCanal;
  readonly registro: Registro;
  /** Para cerrarlas todas al detener el host. */
  readonly abiertas: Set<WebSocket>;
};

export function abrirConexionDeDatos(opciones: OpcionesDeConexionDeDatos): void {
  const { aviso, manejadores, abiertas } = opciones;
  const registro = opciones.registro.con({ conexion: aviso.conexion, canal: aviso.canal });
  const socket = new WebSocket(urlDelRelay(opciones.base, RUTAS.datos));
  abiertas.add(socket);

  socket.on('open', () => {
    socket.send(
      serializarControl({ tipo: 'emparejar', conexion: aviso.conexion, ticket: aviso.ticket }),
    );
  });

  // El primer mensaje es control y es el único: aceptación o rechazo. Lo que
  // venga después ya es del invitado y le toca al manejador.
  socket.once('message', (bytes: Buffer, esBinario: boolean) => {
    const leido = esBinario ? undefined : interpretarControl(bytes.toString('utf8'));
    const mensaje = leido?.ok ? leido.mensaje : undefined;

    if (mensaje?.tipo === 'emparejamiento-aceptado') {
      registro.info('invitado conectado');
      manejadores[aviso.canal]({
        conexion: aviso.conexion,
        canal: aviso.canal,
        socket,
        registro,
      });
      return;
    }

    const causa = mensaje?.tipo === 'emparejamiento-rechazado' ? mensaje.causa : 'respuesta inesperada';
    registro.aviso('emparejamiento rechazado', { causa });
    socket.close(1000);
  });

  socket.on('error', (falla) => {
    registro.aviso('conexión de datos con error', { causa: falla.message });
  });

  socket.on('close', (codigo) => {
    abiertas.delete(socket);
    registro.info('conexión de datos cerrada', { codigo });
  });
}
