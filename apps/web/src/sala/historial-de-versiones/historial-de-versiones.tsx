/**
 * Historial navegable de versiones (H4 / V4 + V5).
 * Lista: id corto, mensaje, fecha, autor. Checkout solo si el host lo ofrece.
 */

import type { CommitVisible } from '../conexion-a-la-sala/conexion-a-la-sala.ts';
import './historial-de-versiones.css';

export function HistorialDeVersiones(props: {
  readonly commits: readonly CommitVisible[];
  readonly tipDeTrabajo?: string | null;
  /** Solo el host puede volver a una versión. */
  readonly alHacerCheckout?: (id: string) => void;
  readonly checkoutDeshabilitado?: boolean;
}) {
  if (props.commits.length === 0) {
    return <p className="historial-vacio">Sin versiones aún.</p>;
  }

  const puedeCheckout = typeof props.alHacerCheckout === 'function';

  return (
    <section className="historial" aria-label="Historial de versiones">
      <h3 className="historial-titulo">Historial</h3>
      <ol className="historial-lista">
        {[...props.commits].reverse().map((c) => {
          const esTip = props.tipDeTrabajo === c.id;
          return (
            <li
              key={c.id}
              className={esTip ? 'historial-entrada historial-entrada-tip' : 'historial-entrada'}
            >
              <div className="historial-linea">
                <span className="historial-msg">{c.mensaje.trim() === '' ? '(sin mensaje)' : c.mensaje}</span>
                <span className="historial-id">{c.id.slice(0, 8)}</span>
              </div>
              <div className="historial-meta">
                <span className="historial-autor">{c.autor.trim() === '' ? '(sin autor)' : c.autor}</span>
                <time dateTime={new Date(c.creadoEn).toISOString()}>{formatearFecha(c.creadoEn)}</time>
              </div>
              {puedeCheckout ? (
                <button
                  type="button"
                  className="historial-checkout"
                  disabled={props.checkoutDeshabilitado || esTip}
                  onClick={() => props.alHacerCheckout?.(c.id)}
                >
                  {esTip ? 'Versión actual' : 'Volver a esta'}
                </button>
              ) : esTip ? (
                <p className="historial-tip-etiqueta">Versión actual</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatearFecha(creadoEn: number): string {
  try {
    return new Date(creadoEn).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(creadoEn);
  }
}
