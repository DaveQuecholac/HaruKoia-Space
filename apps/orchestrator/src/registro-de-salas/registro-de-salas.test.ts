import {
  type CausaDeCierre,
  type IdentidadDeSala,
  generarIdentidadDeSala,
} from '@harukoia/domain';
import { crearRegistro, formatearLinea } from '@harukoia/registro';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  TOLERANCIA_SIN_LATIDO,
  type EnlaceDeControl,
  crearRegistroDeSalas,
} from './registro-de-salas.ts';

/** Doble del enlace: anota qué se le mandó y con qué causa se cerró. */
function enlaceDePrueba() {
  const enviados: string[] = [];
  const cierres: CausaDeCierre[] = [];
  const enlace: EnlaceDeControl = {
    enviar: (texto) => enviados.push(texto),
    cerrar: (causa) => cierres.push(causa),
  };

  return { enlace, enviados, cierres };
}

let instante = 1_000_000;
let lineas: string[];

function nuevoRegistro(tolerancia = TOLERANCIA_SIN_LATIDO) {
  return crearRegistroDeSalas({
    registro: crearRegistro({
      proceso: 'orquestador',
      destino: (evento) => lineas.push(formatearLinea(evento)),
    }),
    reloj: () => instante,
    toleranciaSinLatido: tolerancia,
  });
}

function avanzar(milisegundos: number) {
  instante += milisegundos;
}

let identidad: IdentidadDeSala;

beforeEach(() => {
  instante = 1_000_000;
  lineas = [];
  identidad = generarIdentidadDeSala();
});

describe('alta y resolución', () => {
  it('registra una sala y la encuentra por su identificador', () => {
    const registro = nuevoRegistro();
    const { enlace } = enlaceDePrueba();

    const alta = registro.registrar({
      sala: identidad.sala,
      tokenDeHost: identidad.tokenDeHost,
      tokenDeInvitacion: identidad.tokenDeInvitacion,
      enlace,
    });

    expect(alta).toEqual({ ok: true, reemplazo: false });
    expect(registro.resolver(identidad.sala)?.sala).toBe(identidad.sala);
    expect(registro.salasVivas()).toBe(1);
  });

  it('una sala que no existe no se resuelve', () => {
    const registro = nuevoRegistro();

    expect(registro.resolver(identidad.sala)).toBeUndefined();
    expect(registro.salasVivas()).toBe(0);
  });

  it('resolver no entrega el token de host', () => {
    const registro = nuevoRegistro();
    registro.registrar({
      sala: identidad.sala,
      tokenDeHost: identidad.tokenDeHost,
      tokenDeInvitacion: identidad.tokenDeInvitacion,
      enlace: enlaceDePrueba().enlace,
    });

    const resuelta = registro.resolver(identidad.sala);

    expect(JSON.stringify(resuelta)).not.toContain(identidad.tokenDeHost);
  });

  it('dos salas distintas conviven', () => {
    const registro = nuevoRegistro();
    const otra = generarIdentidadDeSala();

    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    registro.registrar({ ...otra, enlace: enlaceDePrueba().enlace });

    expect(registro.salasVivas()).toBe(2);
  });
});

describe('otro host reclama una sala ocupada', () => {
  it('lo rechaza con causa clara', () => {
    const registro = nuevoRegistro();
    const original = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: original.enlace });

    const intruso = generarIdentidadDeSala();
    const resultado = registro.registrar({
      sala: identidad.sala,
      tokenDeHost: intruso.tokenDeHost,
      tokenDeInvitacion: intruso.tokenDeInvitacion,
      enlace: enlaceDePrueba().enlace,
    });

    expect(resultado).toEqual({ ok: false, causa: 'sala-ocupada-por-otro-host' });
  });

  it('no desaloja al host legítimo', () => {
    const registro = nuevoRegistro();
    const original = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: original.enlace });

    const intruso = generarIdentidadDeSala();
    registro.registrar({
      sala: identidad.sala,
      tokenDeHost: intruso.tokenDeHost,
      tokenDeInvitacion: intruso.tokenDeInvitacion,
      enlace: enlaceDePrueba().enlace,
    });

    expect(original.cierres).toEqual([]);
    expect(registro.salasVivas()).toBe(1);
  });
});

describe('el mismo host vuelve — decisión D5', () => {
  it('recupera su sala de inmediato, sin esperar a que expire', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    avanzar(2_000);
    const nuevo = enlaceDePrueba();
    const resultado = registro.registrar({ ...identidad, enlace: nuevo.enlace });

    expect(resultado).toEqual({ ok: true, reemplazo: true });
    expect(registro.salasVivas()).toBe(1);
  });

  it('cierra la conexión anterior con la causa del protocolo', () => {
    const registro = nuevoRegistro();
    const vieja = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: vieja.enlace });

    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    expect(vieja.cierres).toEqual(['host-reemplazado']);
  });

  it('a partir del reemplazo, el enlace vivo es el nuevo', () => {
    const registro = nuevoRegistro();
    const vieja = enlaceDePrueba();
    const nueva = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: vieja.enlace });
    registro.registrar({ ...identidad, enlace: nueva.enlace });

    registro.resolver(identidad.sala)?.enlace.enviar('hola');

    expect(nueva.enviados).toEqual(['hola']);
    expect(vieja.enviados).toEqual([]);
  });

  it('conserva desde cuándo existe la sala', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    const original = registro.resolver(identidad.sala)?.registradaEn;

    avanzar(5_000);
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    expect(registro.resolver(identidad.sala)?.registradaEn).toBe(original);
  });
});

describe('latido', () => {
  it('mantiene viva la sala más allá de la tolerancia', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    for (let i = 0; i < 5; i += 1) {
      avanzar(TOLERANCIA_SIN_LATIDO - 1_000);
      expect(registro.latido(identidad.sala, identidad.tokenDeHost).ok).toBe(true);
    }

    expect(registro.salasVivas()).toBe(1);
  });

  it('rechaza un latido con el token equivocado', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    const otro = generarIdentidadDeSala();

    expect(registro.latido(identidad.sala, otro.tokenDeHost)).toEqual({
      ok: false,
      causa: 'token-de-host-invalido',
    });
  });

  it('rechaza un latido de una sala que no existe', () => {
    const registro = nuevoRegistro();

    expect(registro.latido(identidad.sala, identidad.tokenDeHost)).toEqual({
      ok: false,
      causa: 'sala-no-encontrada',
    });
  });
});

describe('expiración por falta de latido', () => {
  it('la sala desaparece y el contador vuelve a cero', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    avanzar(TOLERANCIA_SIN_LATIDO + 1);

    expect(registro.salasVivas()).toBe(0);
    expect(registro.resolver(identidad.sala)).toBeUndefined();
  });

  it('justo en el límite todavía está viva', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    avanzar(TOLERANCIA_SIN_LATIDO);

    expect(registro.salasVivas()).toBe(1);
  });

  it('barrer la retira y cierra su enlace con la causa correcta', () => {
    const registro = nuevoRegistro();
    const caida = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: caida.enlace });

    avanzar(TOLERANCIA_SIN_LATIDO + 1);
    const retiradas = registro.barrer();

    expect(retiradas).toEqual([identidad.sala]);
    expect(caida.cierres).toEqual(['host-sin-latido']);
  });

  it('barrer no toca las salas sanas', () => {
    const registro = nuevoRegistro();
    const viva = enlaceDePrueba();
    const muerta = enlaceDePrueba();
    const otra = generarIdentidadDeSala();

    registro.registrar({ ...identidad, enlace: muerta.enlace });
    avanzar(TOLERANCIA_SIN_LATIDO + 1);
    registro.registrar({ ...otra, enlace: viva.enlace });

    registro.barrer();

    expect(viva.cierres).toEqual([]);
    expect(registro.salasVivas()).toBe(1);
  });

  it('no deja salas fantasma: después de barrer no queda nada', () => {
    const registro = nuevoRegistro();
    for (let i = 0; i < 10; i += 1) {
      registro.registrar({ ...generarIdentidadDeSala(), enlace: enlaceDePrueba().enlace });
    }

    avanzar(TOLERANCIA_SIN_LATIDO + 1);
    registro.barrer();

    expect(registro.salasVivas()).toBe(0);
    expect(registro.barrer()).toEqual([]);
  });

  it('el host puede volver a registrar su sala después de expirar', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    avanzar(TOLERANCIA_SIN_LATIDO + 1);
    const resultado = registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });

    expect(resultado).toEqual({ ok: true, reemplazo: false });
    expect(registro.salasVivas()).toBe(1);
  });
});

describe('baja', () => {
  it('el host cierra su sala y deja de resolverse', () => {
    const registro = nuevoRegistro();
    const enlace = enlaceDePrueba();
    registro.registrar({ ...identidad, enlace: enlace.enlace });

    const resultado = registro.cerrar(identidad.sala, identidad.tokenDeHost);

    expect(resultado.ok).toBe(true);
    expect(registro.resolver(identidad.sala)).toBeUndefined();
    expect(enlace.cierres).toEqual(['host-cerro-la-sala']);
  });

  it('nadie más puede cerrar una sala ajena', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    const otro = generarIdentidadDeSala();

    expect(registro.cerrar(identidad.sala, otro.tokenDeHost)).toEqual({
      ok: false,
      causa: 'token-de-host-invalido',
    });
    expect(registro.salasVivas()).toBe(1);
  });
});

describe('rastro en el registro de log', () => {
  it('cada evento de una sala se puede seguir filtrando por su identificador', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    registro.cerrar(identidad.sala, identidad.tokenDeHost);

    const deLaSala = lineas.filter((linea) => linea.includes(`sala=${identidad.sala}`));

    expect(deLaSala).toHaveLength(3);
  });

  it('un rechazo deja su causa en el log', () => {
    const registro = nuevoRegistro();
    registro.registrar({ ...identidad, enlace: enlaceDePrueba().enlace });
    const intruso = generarIdentidadDeSala();

    registro.registrar({
      sala: identidad.sala,
      tokenDeHost: intruso.tokenDeHost,
      tokenDeInvitacion: intruso.tokenDeInvitacion,
      enlace: enlaceDePrueba().enlace,
    });

    expect(lineas.some((linea) => linea.includes('causa=sala-ocupada-por-otro-host'))).toBe(true);
  });
});
