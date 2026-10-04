/**
 * Sala en vivo del host. Fijado en el paso B5, con D2 confirmada: es la sala
 * Yjs real desde H1, con su presencia.
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
 */

import { Hocuspocus } from '@hocuspocus/server';
import type { IdentificadorDeSala } from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';

import type { ManejadorDeCanal } from '../conexion-al-orquestador/conexion-de-datos/conexion-de-datos.ts';
import { type Participante, participantesDe } from '../participantes/participantes.ts';

/**
 * Treinta segundos sin recibir nada y la conexión se da por muerta (decisión
 * de B5). Es también lo que tarda Yjs en olvidar una presencia sin renovar, y
 * la tolerancia del latido del host. Una conexión sana manda su presencia cada
 * ~15 s, así que cabe dos veces.
 */
export const TIEMPO_DE_ESPERA_DE_LA_SALA = 30_000;

export type OpcionesDeLaSala = {
  readonly sala: IdentificadorDeSala;
  readonly registro: Registro;
  /** Solo para pruebas. */
  readonly tiempoDeEspera?: number;
};

export type SalaEnVivo = {
  /** El manejador del canal `sesion`. */
  readonly manejador: ManejadorDeCanal;
  participantes(): Participante[];
  cerrar(): Promise<void>;
};

export async function abrirSalaEnVivo(opciones: OpcionesDeLaSala): Promise<SalaEnVivo> {
  const { sala } = opciones;
  const registro = opciones.registro.con({ sala });

  const hocuspocus = new Hocuspocus({
    quiet: true,
    timeout: opciones.tiempoDeEspera ?? TIEMPO_DE_ESPERA_DE_LA_SALA,
    async onConnect({ documentName }) {
      if (documentName !== sala) {
        registro.aviso('documento ajeno a la sala, rechazado');
        throw new Error('documento ajeno a la sala');
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
    async cerrar() {
      hocuspocus.closeConnections();
      await directa.disconnect();
    },
  };
}
