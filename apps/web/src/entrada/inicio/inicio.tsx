import type { TokenDeWebDelHost } from '@harukoia/domain';
import { type FormEvent, useState } from 'react';

import { VolvermeHost } from '../../host/volverme-host/volverme-host.tsx';
import { type Invitacion, leerEnlace } from '../enlace-de-invitacion/enlace-de-invitacion.ts';

export function Inicio(props: {
  readonly nombre: string;
  readonly urlDelHost: string;
  readonly alCambiarNombre: () => void;
  readonly alSerHost: (invitacion: Invitacion, tokenDeWebDelHost: TokenDeWebDelHost) => void;
  readonly alUnirse: (enlace: string) => void;
}) {
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string>();

  function unirse(evento: FormEvent) {
    evento.preventDefault();
    if (!leerEnlace(enlace.trim())) {
      setError('Ese link no es de una sala de HaruKoia. Pídele al host que te lo copie de nuevo.');
      return;
    }
    props.alUnirse(enlace.trim());
  }

  return (
    <>
      <p>
        Hola, <strong>{props.nombre}</strong>.{' '}
        <button type="button" onClick={props.alCambiarNombre}>
          Cambiar nombre
        </button>
      </p>

      <h2>Abrir una sala</h2>
      <VolvermeHost urlDelHost={props.urlDelHost} alObtener={props.alSerHost} />

      <h2>Unirme a una sala</h2>
      <form onSubmit={unirse}>
        <input
          placeholder="Pega aquí el link de invitación"
          value={enlace}
          onChange={(e) => {
            setEnlace(e.target.value);
            setError(undefined);
          }}
          size={60}
        />{' '}
        <button type="submit" disabled={!enlace.trim()}>
          Unirme
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
