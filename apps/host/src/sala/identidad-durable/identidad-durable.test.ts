import { Entry } from '@napi-rs/keyring';
import { generarIdentidadDeSala, rotarTokenDeInvitacion } from '@harukoia/domain';
import { afterEach, describe, expect, it } from 'vitest';

import {
  CUENTA_POR_DEFECTO,
  SERVICIO_DE_LA_IDENTIDAD,
  cuentaDeLaIdentidad,
  guardarIdentidad,
  identidadParaArrancar,
  leerIdentidad,
} from './identidad-durable.ts';

const cuentas: string[] = [];

afterEach(() => {
  for (const cuenta of cuentas.splice(0)) {
    new Entry(SERVICIO_DE_LA_IDENTIDAD, cuenta, { linux: { store: 'secret-service' } }).deletePassword();
  }
});

describe('identidad durable', () => {
  it('una cuenta vacía no es un almacén', () => {
    expect(() => cuentaDeLaIdentidad({ SALA_IDENTIDAD: '' })).toThrow(/SALA_IDENTIDAD está vacía/);
  });

  it('sin variable usa la cuenta del host', () => {
    expect(cuentaDeLaIdentidad({})).toBe(CUENTA_POR_DEFECTO);
  });

  it('la segunda lectura devuelve los mismos cuatro campos', () => {
    const cuenta = cuentaNueva();
    const creada = generarIdentidadDeSala();
    let creaciones = 0;

    const primera = identidadParaArrancar(cuenta, () => {
      creaciones += 1;
      return creada;
    });
    const segunda = identidadParaArrancar(cuenta, () => {
      creaciones += 1;
      return generarIdentidadDeSala();
    });

    expect(creaciones).toBe(1);
    expect(segunda).toEqual(primera);
    expect(segunda).toEqual(creada);
  });

  it('rotar guarda solo el token de invitación nuevo', () => {
    const cuenta = cuentaNueva();
    const creada = generarIdentidadDeSala();
    guardarIdentidad(cuenta, creada);

    const rotada = rotarTokenDeInvitacion(creada);
    guardarIdentidad(cuenta, rotada);

    const leida = leerIdentidad(cuenta);
    expect(leida?.tokenDeInvitacion).toBe(rotada.tokenDeInvitacion);
    expect(leida?.tokenDeInvitacion).not.toBe(creada.tokenDeInvitacion);
    expect(leida?.sala).toBe(creada.sala);
    expect(leida?.tokenDeHost).toBe(creada.tokenDeHost);
    expect(leida?.tokenDeWebDelHost).toBe(creada.tokenDeWebDelHost);
  });

  it('una entrada ilegible no crea otra identidad', () => {
    const cuenta = cuentaNueva();
    new Entry(SERVICIO_DE_LA_IDENTIDAD, cuenta, { linux: { store: 'secret-service' } }).setPassword('{}');
    let creaciones = 0;

    expect(() =>
      identidadParaArrancar(cuenta, () => {
        creaciones += 1;
        return generarIdentidadDeSala();
      }),
    ).toThrow(/no se puede leer/);
    expect(creaciones).toBe(0);
  });
});

function cuentaNueva(): string {
  const cuenta = `prueba-${process.pid}-${cuentas.length}-${Date.now()}`;
  cuentas.push(cuenta);
  return cuenta;
}
