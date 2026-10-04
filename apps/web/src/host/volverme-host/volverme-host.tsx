import type { TokenDeWebDelHost } from '@harukoia/domain';
import { useState } from 'react';

import type { Invitacion } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { pedirInvitacion } from '../pedir-invitacion/pedir-invitacion.ts';

const MENSAJES = {
  'host-no-encontrado': 'No hay un host corriendo en esta máquina. Arráncalo con pnpm dev en apps/host y vuelve a intentar.',
  'host-rechazo': 'El host de esta máquina no le dio la invitación a esta web. Revisa WEB_ORIGEN en apps/host/.env.',
} as const;

export function VolvermeHost(props: {
  readonly urlDelHost: string;
  readonly alObtener: (invitacion: Invitacion, tokenDeWebDelHost: TokenDeWebDelHost) => void;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [error, setError] = useState<string>();

  async function pedir() {
    setPidiendo(true);
    setError(undefined);
    const resultado = await pedirInvitacion(props.urlDelHost);
    setPidiendo(false);
    if (resultado.ok) props.alObtener(resultado.invitacion, resultado.tokenDeWebDelHost);
    else setError(MENSAJES[resultado.causa]);
  }

  return (
    <section>
      <button type="button" onClick={pedir} disabled={pidiendo}>
        {pidiendo ? 'Buscando el host…' : 'Volverme host'}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
