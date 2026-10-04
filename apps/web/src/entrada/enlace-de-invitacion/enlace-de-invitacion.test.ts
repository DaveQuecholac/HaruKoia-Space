import { generarIdentidadDeSala } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { crearEnlace, esRutaDeSala, leerEnlace } from './enlace-de-invitacion.ts';

const { sala, tokenDeInvitacion } = generarIdentidadDeSala();
const origen = 'https://web.harukoia.local.iokoia.dev';

describe('link de invitación', () => {
  it('lleva la sala en la ruta y el token en el fragmento', () => {
    const enlace = crearEnlace(origen, { sala, tokenDeInvitacion });

    expect(enlace).toBe(`${origen}/s/${sala}#${tokenDeInvitacion}`);
    expect(new URL(enlace).pathname).not.toContain(tokenDeInvitacion);
  });

  it('se lee de vuelta', () => {
    expect(leerEnlace(crearEnlace(origen, { sala, tokenDeInvitacion }))).toEqual({ sala, tokenDeInvitacion });
  });

  it('un link roto no es una invitación', () => {
    expect(leerEnlace(`${origen}/s/${sala}`)).toBeUndefined();
    expect(leerEnlace(`${origen}/s/no-es-sala#${tokenDeInvitacion}`)).toBeUndefined();
    expect(leerEnlace(`${origen}/otra/${sala}#${tokenDeInvitacion}`)).toBeUndefined();
    expect(leerEnlace('esto no es un link')).toBeUndefined();
  });

  it('distingue la ruta de una sala aunque el link venga roto', () => {
    expect(esRutaDeSala(`/s/${sala}`)).toBe(true);
    expect(esRutaDeSala('/')).toBe(false);
  });
});
