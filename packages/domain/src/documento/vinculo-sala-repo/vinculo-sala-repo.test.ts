import { describe, expect, it } from 'vitest';

import { generarIdentidadDeSala } from '../../sala/identidad-de-sala/identidad-de-sala.ts';
import { comoVinculoSalaRepo, crearVinculoSalaRepo } from './vinculo-sala-repo.ts';

describe('vínculo sala↔repo', () => {
  it('crea con sala y raíz de checkout', () => {
    const { sala } = generarIdentidadDeSala();
    const creado = crearVinculoSalaRepo({ sala, raizDelCheckout: '/tmp/proyecto' });
    expect(creado.ok).toBe(true);
    if (!creado.ok) return;
    expect(creado.vinculo.sala).toBe(sala);
    expect(creado.vinculo.raizDelCheckout).toBe('/tmp/proyecto');
  });

  it('rechaza raíz vacía', () => {
    const { sala } = generarIdentidadDeSala();
    expect(crearVinculoSalaRepo({ sala, raizDelCheckout: '  ' }).ok).toBe(false);
  });

  it('interpreta un objeto crudo', () => {
    const { sala } = generarIdentidadDeSala();
    const vinculo = comoVinculoSalaRepo({ sala, raizDelCheckout: '/repo' });
    expect(vinculo.raizDelCheckout).toBe('/repo');
  });
});
