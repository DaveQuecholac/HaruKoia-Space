import { generarIdentidadDeSala } from '@harukoia/domain';
import { describe, expect, it } from 'vitest';

import { rolDelToken } from './rol-de-la-conexion.ts';

const { tokenDeWebDelHost, tokenDeInvitacion } = generarIdentidadDeSala();

describe('rol de la conexión', () => {
  it('el token de la web del host da rol host', () => {
    expect(rolDelToken(tokenDeWebDelHost, tokenDeWebDelHost)).toBe('host');
  });

  it('sin token, con otro token o con el de invitación, espectador', () => {
    expect(rolDelToken('', tokenDeWebDelHost)).toBe('espectador');
    expect(rolDelToken(generarIdentidadDeSala().tokenDeWebDelHost, tokenDeWebDelHost)).toBe('espectador');
    expect(rolDelToken(tokenDeInvitacion, tokenDeWebDelHost)).toBe('espectador');
    expect(rolDelToken('host', tokenDeWebDelHost)).toBe('espectador');
  });
});
