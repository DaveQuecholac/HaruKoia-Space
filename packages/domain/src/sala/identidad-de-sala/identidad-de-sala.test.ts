import { describe, expect, it } from 'vitest';

import {
  LONGITUD_DEL_IDENTIFICADOR,
  LONGITUD_DEL_TOKEN,
  comoIdentificadorDeSala,
  comoTokenDeHost,
  generarIdentidadDeSala,
  rotarTokenDeInvitacion,
} from './identidad-de-sala.ts';

describe('identidad de una sala', () => {
  it('genera tres valores distintos', () => {
    const { sala, tokenDeHost, tokenDeInvitacion } = generarIdentidadDeSala();

    expect(new Set([sala, tokenDeHost, tokenDeInvitacion]).size).toBe(3);
  });

  it('el identificador es más corto que los tokens, y los tokens son secretos largos', () => {
    const identidad = generarIdentidadDeSala();

    expect(identidad.sala).toHaveLength(LONGITUD_DEL_IDENTIFICADOR);
    expect(identidad.tokenDeHost).toHaveLength(LONGITUD_DEL_TOKEN);
    expect(identidad.tokenDeInvitacion).toHaveLength(LONGITUD_DEL_TOKEN);
    expect(LONGITUD_DEL_TOKEN).toBeGreaterThan(LONGITUD_DEL_IDENTIFICADOR);
  });

  it('dos salas no comparten ningún valor', () => {
    const una = generarIdentidadDeSala();
    const otra = generarIdentidadDeSala();

    expect(una.sala).not.toBe(otra.sala);
    expect(una.tokenDeHost).not.toBe(otra.tokenDeHost);
    expect(una.tokenDeInvitacion).not.toBe(otra.tokenDeInvitacion);
  });
});

describe('rotar la invitación — lo que compra D4', () => {
  it('cambia el token de invitación sin tocar la sala ni el token de host', () => {
    const antes = generarIdentidadDeSala();

    const despues = rotarTokenDeInvitacion(antes);

    expect(despues.sala).toBe(antes.sala);
    expect(despues.tokenDeHost).toBe(antes.tokenDeHost);
    expect(despues.tokenDeInvitacion).not.toBe(antes.tokenDeInvitacion);
  });

  it('no modifica la identidad original', () => {
    const antes = generarIdentidadDeSala();
    const copia = { ...antes };

    rotarTokenDeInvitacion(antes);

    expect(antes).toEqual(copia);
  });
});

describe('lo que llega de la red se valida', () => {
  it('acepta un identificador de sala bien formado', () => {
    const { sala } = generarIdentidadDeSala();

    expect(comoIdentificadorDeSala(sala)).toBe(sala);
  });

  it('rechaza un identificador de sala con longitud de token', () => {
    const { tokenDeHost } = generarIdentidadDeSala();

    expect(() => comoIdentificadorDeSala(tokenDeHost)).toThrow();
  });

  it('rechaza un token con longitud de identificador', () => {
    const { sala } = generarIdentidadDeSala();

    expect(() => comoTokenDeHost(sala)).toThrow();
  });

  it('rechaza basura', () => {
    expect(() => comoIdentificadorDeSala('')).toThrow();
    expect(() => comoIdentificadorDeSala(null)).toThrow();
    expect(() => comoIdentificadorDeSala('SALA-CON-MAYUSCULAS')).toThrow();
  });
});
