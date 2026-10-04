/**
 * Registro de salas vivas. Fijado en el paso B2.
 *
 * Qué sabe: qué salas existen y cómo alcanzar al host de cada una. **En
 * memoria, sin base de datos.** Si el orquestador reinicia, los hosts se
 * vuelven a registrar: el registro no es una fuente de verdad que haya que
 * conservar, es un directorio de lo que está vivo ahora.
 *
 * Qué **no** sabe: nada del contenido de una sala. El tablero vive en el host.
 *
 * Este módulo es lógica pura y síncrona: el reloj se inyecta y la expiración se
 * calcula, no se agenda. Así las pruebas no esperan en tiempo real y el proceso
 * no arrastra temporizadores. Quién llama a `barrer` periódicamente es asunto
 * del proceso, en el paso B3.
 */

import { timingSafeEqual } from 'node:crypto';

import type {
  CausaDeCierre,
  CausaDeRechazo,
  IdentificadorDeSala,
  TokenDeHost,
  TokenDeInvitacion,
} from '@harukoia/domain';
import type { Registro } from '@harukoia/registro';

/**
 * Cómo se le habla al host de una sala. El registro no sabe si debajo hay un
 * socket: en las pruebas es un doble, y en B3 será la conexión de control.
 */
export type EnlaceDeControl = {
  readonly enviar: (texto: string) => void;
  readonly cerrar: (causa: CausaDeCierre) => void;
};

export type SalaRegistrada = {
  readonly sala: IdentificadorDeSala;
  readonly enlace: EnlaceDeControl;
  readonly registradaEn: number;
  readonly ultimoLatido: number;
};

export type Resultado =
  | { readonly ok: true; readonly reemplazo: boolean }
  | { readonly ok: false; readonly causa: CausaDeRechazo };

/**
 * Tres latidos perdidos. Con un latido cada 10 segundos, una sala muerta
 * desaparece en 30 y una pausa de red corta no mata una sesión sana.
 */
export const TOLERANCIA_SIN_LATIDO = 30_000;

export type OpcionesDelRegistro = {
  readonly registro: Registro;
  readonly reloj?: () => number;
  readonly toleranciaSinLatido?: number;
};

export type RegistroDeSalas = {
  readonly registrar: (alta: {
    sala: IdentificadorDeSala;
    tokenDeHost: TokenDeHost;
    tokenDeInvitacion: TokenDeInvitacion;
    enlace: EnlaceDeControl;
  }) => Resultado;
  /**
   * Decisión 1 de B3: el orquestador valida la invitación. Puede hacerlo
   * porque el relay ya transporta todos los bytes de la sesión en claro;
   * esconderle este token no protegería nada y costaría una ida y vuelta.
   */
  readonly validarInvitacion: (
    sala: IdentificadorDeSala,
    tokenDeInvitacion: TokenDeInvitacion,
  ) => Resultado;
  readonly latido: (sala: IdentificadorDeSala, tokenDeHost: TokenDeHost) => Resultado;
  /** B8: el link anterior deja de servir para entrar. Quien ya entró sigue dentro. */
  readonly cambiarInvitacion: (
    sala: IdentificadorDeSala,
    tokenDeHost: TokenDeHost,
    tokenDeInvitacion: TokenDeInvitacion,
  ) => Resultado;
  readonly cerrar: (sala: IdentificadorDeSala, tokenDeHost: TokenDeHost) => Resultado;
  readonly resolver: (sala: IdentificadorDeSala) => SalaRegistrada | undefined;
  readonly barrer: () => IdentificadorDeSala[];
  readonly salasVivas: () => number;
};

/**
 * Comparación de secreto en tiempo constante: el tiempo que tarda no revela
 * cuántos caracteres del token acertó quien lo intenta.
 */
function tokensIguales(unoDado: string, elGuardado: string): boolean {
  const dado = Buffer.from(unoDado);
  const guardado = Buffer.from(elGuardado);

  if (dado.length !== guardado.length) return false;
  return timingSafeEqual(dado, guardado);
}

type Entrada = SalaRegistrada & {
  readonly tokenDeHost: TokenDeHost;
  readonly tokenDeInvitacion: TokenDeInvitacion;
};

export function crearRegistroDeSalas(opciones: OpcionesDelRegistro): RegistroDeSalas {
  const { registro } = opciones;
  const ahora = opciones.reloj ?? (() => Date.now());
  const tolerancia = opciones.toleranciaSinLatido ?? TOLERANCIA_SIN_LATIDO;

  const salas = new Map<IdentificadorDeSala, Entrada>();

  const expirada = (entrada: Entrada): boolean => ahora() - entrada.ultimoLatido > tolerancia;

  const vigente = (sala: IdentificadorDeSala): Entrada | undefined => {
    const entrada = salas.get(sala);
    if (!entrada || expirada(entrada)) return undefined;
    return entrada;
  };

  /** Resuelve la sala comprobando el token, o devuelve la causa del rechazo. */
  const conToken = (
    sala: IdentificadorDeSala,
    tokenDeHost: TokenDeHost,
  ): { entrada: Entrada } | { causa: CausaDeRechazo } => {
    const entrada = vigente(sala);
    if (!entrada) return { causa: 'sala-no-encontrada' };
    if (!tokensIguales(tokenDeHost, entrada.tokenDeHost)) {
      return { causa: 'token-de-host-invalido' };
    }
    return { entrada };
  };

  return {
    registrar: ({ sala, tokenDeHost, tokenDeInvitacion, enlace }) => {
      const instante = ahora();
      const previa = salas.get(sala);
      const registroDeLaSala = registro.con({ sala });

      // Una sala sin latido ya no existe: no puede bloquear un alta nueva.
      if (previa && expirada(previa)) {
        salas.delete(sala);
        registroDeLaSala.aviso('registro anterior descartado por falta de latido');
      }

      const ocupante = salas.get(sala);

      if (ocupante) {
        if (!tokensIguales(tokenDeHost, ocupante.tokenDeHost)) {
          registroDeLaSala.aviso('alta rechazada', { causa: 'sala-ocupada-por-otro-host' });
          return { ok: false, causa: 'sala-ocupada-por-otro-host' };
        }

        // Decisión D5: el mismo host recupera su sala de inmediato y la
        // conexión anterior se cierra, en lugar de esperar a que expire.
        ocupante.enlace.cerrar('host-reemplazado');
        salas.set(sala, {
          sala,
          tokenDeHost,
          tokenDeInvitacion,
          enlace,
          registradaEn: ocupante.registradaEn,
          ultimoLatido: instante,
        });
        registroDeLaSala.info('sala recuperada por su host', { reemplazo: true });
        return { ok: true, reemplazo: true };
      }

      salas.set(sala, {
        sala,
        tokenDeHost,
        tokenDeInvitacion,
        enlace,
        registradaEn: instante,
        ultimoLatido: instante,
      });
      registroDeLaSala.info('sala registrada', { vivas: salas.size });
      return { ok: true, reemplazo: false };
    },

    latido: (sala, tokenDeHost) => {
      const encontrado = conToken(sala, tokenDeHost);
      if ('causa' in encontrado) {
        registro.con({ sala }).aviso('latido rechazado', { causa: encontrado.causa });
        return { ok: false, causa: encontrado.causa };
      }

      salas.set(sala, { ...encontrado.entrada, ultimoLatido: ahora() });
      return { ok: true, reemplazo: false };
    },

    cambiarInvitacion: (sala, tokenDeHost, tokenDeInvitacion) => {
      const encontrado = conToken(sala, tokenDeHost);
      if ('causa' in encontrado) {
        registro.con({ sala }).aviso('cambio de invitación rechazado', { causa: encontrado.causa });
        return { ok: false, causa: encontrado.causa };
      }

      salas.set(sala, { ...encontrado.entrada, tokenDeInvitacion });
      registro.con({ sala }).info('invitación cambiada por su host');
      return { ok: true, reemplazo: false };
    },

    cerrar: (sala, tokenDeHost) => {
      const encontrado = conToken(sala, tokenDeHost);
      if ('causa' in encontrado) {
        registro.con({ sala }).aviso('cierre rechazado', { causa: encontrado.causa });
        return { ok: false, causa: encontrado.causa };
      }

      salas.delete(sala);
      encontrado.entrada.enlace.cerrar('host-cerro-la-sala');
      registro.con({ sala }).info('sala cerrada por su host', { vivas: salas.size });
      return { ok: true, reemplazo: false };
    },

    validarInvitacion: (sala, tokenDeInvitacion) => {
      const entrada = vigente(sala);
      if (!entrada) {
        registro.con({ sala }).aviso('entrada rechazada', { causa: 'sala-no-encontrada' });
        return { ok: false, causa: 'sala-no-encontrada' };
      }

      if (!tokensIguales(tokenDeInvitacion, entrada.tokenDeInvitacion)) {
        registro
          .con({ sala })
          .aviso('entrada rechazada', { causa: 'token-de-invitacion-invalido' });
        return { ok: false, causa: 'token-de-invitacion-invalido' };
      }

      return { ok: true, reemplazo: false };
    },

    resolver: (sala) => {
      const entrada = vigente(sala);
      if (!entrada) return undefined;

      // Los dos tokens se quedan dentro: lo que sale no puede filtrarlos.
      return {
        sala: entrada.sala,
        enlace: entrada.enlace,
        registradaEn: entrada.registradaEn,
        ultimoLatido: entrada.ultimoLatido,
      };
    },

    barrer: () => {
      const caidas: IdentificadorDeSala[] = [];

      for (const [sala, entrada] of salas) {
        if (!expirada(entrada)) continue;

        salas.delete(sala);
        entrada.enlace.cerrar('host-sin-latido');
        registro.con({ sala }).aviso('sala retirada por falta de latido');
        caidas.push(sala);
      }

      return caidas;
    },

    salasVivas: () => {
      let vivas = 0;
      for (const entrada of salas.values()) {
        if (!expirada(entrada)) vivas += 1;
      }
      return vivas;
    },
  };
}
