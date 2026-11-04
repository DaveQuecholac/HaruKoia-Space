import { type FormEvent, useState } from 'react';

export function PedirNombre(props: { readonly inicial: string | undefined; readonly alElegir: (nombre: string) => void }) {
  const [nombre, setNombre] = useState(props.inicial ?? '');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (nombre.trim()) props.alElegir(nombre.trim());
  }

  return (
    <form onSubmit={enviar}>
      <label>
        ¿Cómo te llamas?{' '}
        <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={40} />
      </label>{' '}
      <button type="submit" disabled={!nombre.trim()}>
        Listo
      </button>
    </form>
  );
}
