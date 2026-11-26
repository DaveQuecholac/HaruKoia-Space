import { type FormEvent, useState } from 'react';

import './pedir-nombre.css';

export function PedirNombre(props: { readonly inicial: string | undefined; readonly alElegir: (nombre: string) => void }) {
  const [nombre, setNombre] = useState(props.inicial ?? '');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nombre.trim()) props.alElegir(nombre.trim());
  }

  return (
    <form className="pedir-nombre" onSubmit={enviar}>
      <label htmlFor="pedir-nombre-campo">¿Cómo te llamas?</label>
      <div className="pedir-nombre-fila">
        <input
          id="pedir-nombre-campo"
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          placeholder="Tu nombre en la sala"
        />
        <button type="submit" disabled={!nombre.trim()}>
          Listo
        </button>
      </div>
    </form>
  );
}
