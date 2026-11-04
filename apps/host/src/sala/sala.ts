/**
 * Sala en vivo del host. Fijado en el paso B5, con D2 confirmada: es la sala
 * Yjs real desde H1, con su presencia. Los roles entran en B8.
 *
 * Hocuspocus corre **sin servidor propio**: el host no acepta conexiones (D3).
 * Cada conexión de datos que llega por el túnel se le entrega como socket ya
 * abierto, y este archivo le pasa los bytes y el cierre.
 *
 * Un solo documento, con el nombre de la sala. Cualquier otro nombre se
 * rechaza: sin eso, un invitado podría crear documentos en la memoria del host.
 *
 * El host mantiene abierto el documento con una conexión directa. Sin ella,
 * Hocuspocus lo descargaría al irse el último invitado y la sala se vaciaría
 * con el host todavía vivo. Que la sala arranque vacía al **reiniciar** el
 * host es lo esperado en H1; la persistencia es H3.
 *
 * Roles (B8): el rol de cada conexión sale de su token en `onAuthenticate` y
 * se le dice al conectarse. En la presencia, el campo `rol` lo **sella** el
 * host con el de la conexión que la mandó, y cada participante queda amarrado
 * a la conexión que lo anunció primero: otra no puede escribir en su nombre.
 */

import { type Connection, Hocuspocus } from '@hocuspocus/server';
import {
  type IdentificadorDeSala,
  type MensajeDelHostDeLaSala,
  type TokenDeWebDelHost,
  interpretarMensajeDeSala,
  serializarMensajeDeSala,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';

import { type ManejadoresDeAccion, atenderAccion } from '../acciones-de-sala/acciones-de-sala.ts';
import type { ManejadorDeCanal } from '../conexion-al-orquestador/conexion-de-datos/conexion-de-datos.ts';
import { type Participante, participantesDe } from '../participantes/participantes.ts';
import { type ContextoDeLaConexion, rolDelToken } from '../rol-de-la-conexion/rol-de-la-conexion.ts';

/**
 * Treinta segundos sin recibir nada y la conexión se da por muerta (decisión
 * de B5). Es también lo que tarda Yjs en olvidar una presencia sin renovar, y
 * la tolerancia del latido del host. Una conexión sana manda su presencia cada
 * ~15 s, así que cabe dos veces.
 */
export const TIEMPO_DE_ESPERA_DE_LA_SALA = 30_000;

export type OpcionesDeLaSala = {
  readonly sala: IdentificadorDeSala;
  readonly tokenDeWebDelHost: TokenDeWebDelHost;
  readonly acciones: ManejadoresDeAccion;
  readonly registro: Registro;
  /** Solo para pruebas. */
  readonly tiempoDeEspera?: number;
};

export type SalaEnVivo = {
  /** El manejador del canal `sesion`. */
  readonly manejador: ManejadorDeCanal;
  participantes(): Participante[];
  /** Conexiones de invitados vivas en Hocuspocus. La directa del host no cuenta. */
  conexiones(): number;
  /** Documentos cargados en memoria. Siempre uno: el de la sala. */
  documentos(): number;
  cerrar(): Promise<void>;
};

export async function abrirSalaEnVivo(opciones: OpcionesDeLaSala): Promise<SalaEnVivo> {
  const { sala, tokenDeWebDelHost, acciones } = opciones;
  const registro = opciones.registro.con({ sala });

  /** Conexiones de invitados por `socketId`, con el rol que les dio el host. */
  const abiertas = new Map<string, Connection<ContextoDeLaConexion>>();
  /** Qué conexión anunció primero a cada participante de la presencia. */
  const duenoDelParticipante = new Map<number, string>();

  function enviar(conexion: Connection<ContextoDeLaConexion>, mensaje: MensajeDelHostDeLaSala): void {
    conexion.sendStateless(serializarMensajeDeSala(mensaje));
  }

  const hocuspocus = new Hocuspocus<ContextoDeLaConexion>({
    quiet: true,
    timeout: opciones.tiempoDeEspera ?? TIEMPO_DE_ESPERA_DE_LA_SALA,
    async onAuthenticate({ token }) {
      return { rol: rolDelToken(token, tokenDeWebDelHost) };
    },
    async onConnect({ documentName }) {
      if (documentName !== sala) {
        registro.aviso('documento ajeno a la sala, rechazado');
        throw new Error('documento ajeno a la sala');
      }
    },
    async connected({ socketId, connection, context }) {
      abiertas.set(socketId, connection);
      enviar(connection, { tipo: 'tu-rol', rol: context.rol });
      registro.info('rol asignado', { rol: context.rol });
    },
    async beforeHandleAwareness({ states, context, socketId }) {
      // Sin contexto, el cambio viene de la conexión directa del propio host.
      if (!context) return;
      for (const [cliente, estado] of states) {
        const dueno = duenoDelParticipante.get(cliente);
        if (dueno === undefined) {
          duenoDelParticipante.set(cliente, socketId);
        } else if (dueno !== socketId) {
          registro.aviso('presencia a nombre de otro participante, descartada');
          states.delete(cliente);
          continue;
        }
        if (estado) estado.rol = context.rol;
      }
    },
    async onAwarenessUpdate({ added, removed }) {
      if (added.length === 0 && removed.length === 0) return;
      registro.info('participantes cambiaron', {
        entraron: added.length,
        salieron: removed.length,
        participantes: participantes().length,
      });
    },
    async onStateless({ payload, connection }) {
      const leido = interpretarMensajeDeSala(payload);
      if (!leido.ok || leido.mensaje.tipo !== 'pedir-accion') {
        registro.aviso('mensaje de sala ilegible, descartado', leido.ok ? { tipo: leido.mensaje.tipo } : { detalle: leido.detalle });
        return;
      }

      const { accion } = leido.mensaje;
      const { rol } = connection.context;
      const resultado = await atenderAccion(accion, rol, acciones);

      if (!resultado.ok) {
        registro.aviso('acción rechazada', { accion, rol, causa: resultado.causa });
        enviar(connection, { tipo: 'accion-rechazada', accion, causa: resultado.causa });
        return;
      }

      registro.info('acción ejecutada', { accion });
      for (const { destino, mensaje } of resultado.avisos) {
        for (const abierta of abiertas.values()) {
          if (destino === 'todos' || abierta.context.rol === 'host') enviar(abierta, mensaje);
        }
      }
    },
    async onDisconnect({ socketId }) {
      abiertas.delete(socketId);
      for (const [cliente, dueno] of duenoDelParticipante) {
        if (dueno === socketId) duenoDelParticipante.delete(cliente);
      }
    },
  });

  const directa = await hocuspocus.openDirectConnection(sala);

  function participantes(): Participante[] {
    const documento = directa.document;
    if (!documento) return [];
    return participantesDe(documento.awareness.getStates(), documento.awareness.clientID);
  }

  const manejador: ManejadorDeCanal = ({ socket, registro: registroDeLaConexion }) => {
    const cliente = hocuspocus.handleConnection(socket, new Request(`http://host.harukoia/${sala}`));

    socket.on('message', (bytes: Buffer, esBinario: boolean) => {
      if (!esBinario) {
        registroDeLaConexion.aviso('texto en la conexión de la sala, descartado');
        return;
      }
      cliente.handleMessage(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    });

    socket.on('close', (code: number, reason: Buffer) => {
      cliente.handleClose({ code, reason: reason.toString('utf8') });
    });
  };

  return {
    manejador,
    participantes,
    // Hocuspocus cuenta también la conexión directa del host.
    conexiones: () => hocuspocus.getConnectionsCount() - 1,
    documentos: () => hocuspocus.getDocumentsCount(),
    async cerrar() {
      hocuspocus.closeConnections();
      await directa.disconnect();
    },
  };
}
