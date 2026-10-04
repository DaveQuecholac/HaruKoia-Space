/**
 * Emparejamiento de las dos puntas de un invitado. Fijado en el paso B3.
 *
 * El hueco que llena: entre que un invitado llega y que el host abre su
 * conexión de datos pasan unos cientos de milisegundos. Durante ese rato hay
 * que recordar quién espera, con qué ticket, y desde cuándo.
 *
 * Es lógica pura y genérica sobre el handle del invitado: en las pruebas es un
 * objeto cualquiera y en el túnel es un socket. El reloj se inyecta y la
 * caducidad se **calcula**, no se agenda, así que las pruebas no esperan en
 * tiempo real.
 */

import { timingSafeEqual } from 'node:crypto';

import {
  type Canal,
  type IdentificadorDeConexion,
  type IdentificadorDeSala,
  type Ticket,
  generarIdentificadorDeConexion,
  generarTicket,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';

/**
 * Diez segundos. Si el host no abre la conexión de datos en ese rato, el
 * invitado recibe un error con causa en lugar de quedarse mirando una pantalla
 * que nunca carga.
 */
export const CADUCIDAD_DEL_EMPAREJAMIENTO = 10_000;

export type Pendiente<Invitado> = {
  readonly conexion: IdentificadorDeConexion;
  readonly sala: IdentificadorDeSala;
  readonly canal: Canal;
  readonly invitado: Invitado;
  readonly abiertoEn: number;
};

export type Reclamo<Invitado> =
  | { readonly ok: true; readonly pendiente: Pendiente<Invitado> }
  | { readonly ok: false; readonly causa: 'ticket-invalido' | 'emparejamiento-expirado' };

export type OpcionesDelEmparejador = {
  readonly registro: Registro;
  readonly reloj?: () => number;
  readonly caducidad?: number;
};

export type Emparejador<Invitado> = {
  /** Anota que un invitado espera. Devuelve lo que hay que mandarle al host. */
  readonly abrir: (datos: {
    sala: IdentificadorDeSala;
    canal: Canal;
    invitado: Invitado;
  }) => { conexion: IdentificadorDeConexion; ticket: Ticket };
  /** El host presenta conexión y ticket. De un solo uso: al reclamar, se gasta. */
  readonly reclamar: (conexion: IdentificadorDeConexion, ticket: Ticket) => Reclamo<Invitado>;
  readonly cancelar: (conexion: IdentificadorDeConexion) => Pendiente<Invitado> | undefined;
  /** Retira los que caducaron y los devuelve para avisarle a cada invitado. */
  readonly barrer: () => Pendiente<Invitado>[];
  readonly pendientes: () => number;
  /** Los que esperan por una sala, para cancelarlos si la sala se cierra. */
  readonly deLaSala: (sala: IdentificadorDeSala) => Pendiente<Invitado>[];
};

function ticketsIguales(dado: string, guardado: string): boolean {
  const uno = Buffer.from(dado);
  const otro = Buffer.from(guardado);

  if (uno.length !== otro.length) return false;
  return timingSafeEqual(uno, otro);
}

type Entrada<Invitado> = Pendiente<Invitado> & { readonly ticket: Ticket };

export function crearEmparejador<Invitado>(
  opciones: OpcionesDelEmparejador,
): Emparejador<Invitado> {
  const { registro } = opciones;
  const ahora = opciones.reloj ?? (() => Date.now());
  const caducidad = opciones.caducidad ?? CADUCIDAD_DEL_EMPAREJAMIENTO;

  const esperando = new Map<IdentificadorDeConexion, Entrada<Invitado>>();

  const caducado = (entrada: Entrada<Invitado>): boolean => ahora() - entrada.abiertoEn > caducidad;

  const sinTicket = (entrada: Entrada<Invitado>): Pendiente<Invitado> => {
    const { ticket: _secreto, ...pendiente } = entrada;
    return pendiente;
  };

  return {
    abrir: ({ sala, canal, invitado }) => {
      const conexion = generarIdentificadorDeConexion();
      const ticket = generarTicket();

      esperando.set(conexion, {
        conexion,
        sala,
        canal,
        invitado,
        ticket,
        abiertoEn: ahora(),
      });

      registro.con({ sala, conexion }).info('invitado esperando emparejamiento', { canal });
      return { conexion, ticket };
    },

    reclamar: (conexion, ticket) => {
      const entrada = esperando.get(conexion);

      // Mismo rechazo para un ticket equivocado y para una conexión que no
      // existe: así no se puede sondear qué identificadores están vivos.
      if (!entrada || !ticketsIguales(ticket, entrada.ticket)) {
        registro.con({ conexion }).aviso('emparejamiento rechazado', { causa: 'ticket-invalido' });
        return { ok: false, causa: 'ticket-invalido' };
      }

      if (caducado(entrada)) {
        esperando.delete(conexion);
        registro
          .con({ sala: entrada.sala, conexion })
          .aviso('emparejamiento rechazado', { causa: 'emparejamiento-expirado' });
        return { ok: false, causa: 'emparejamiento-expirado' };
      }

      esperando.delete(conexion);
      registro.con({ sala: entrada.sala, conexion }).info('puntas emparejadas');
      return { ok: true, pendiente: sinTicket(entrada) };
    },

    cancelar: (conexion) => {
      const entrada = esperando.get(conexion);
      if (!entrada) return undefined;

      esperando.delete(conexion);
      return sinTicket(entrada);
    },

    barrer: () => {
      const caidos: Pendiente<Invitado>[] = [];

      for (const [conexion, entrada] of esperando) {
        if (!caducado(entrada)) continue;

        esperando.delete(conexion);
        registro
          .con({ sala: entrada.sala, conexion })
          .aviso('invitado retirado: el host no abrió la conexión de datos');
        caidos.push(sinTicket(entrada));
      }

      return caidos;
    },

    pendientes: () => {
      let vivos = 0;
      for (const entrada of esperando.values()) {
        if (!caducado(entrada)) vivos += 1;
      }
      return vivos;
    },

    deLaSala: (sala) => {
      const suyos: Pendiente<Invitado>[] = [];
      for (const entrada of esperando.values()) {
        if (entrada.sala === sala) suyos.push(sinTicket(entrada));
      }
      return suyos;
    },
  };
}
