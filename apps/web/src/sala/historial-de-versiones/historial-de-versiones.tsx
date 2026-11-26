/**
 * Historial navegable de versiones (H4 / V4 + V5) + estado de push (H5 / P8).
 * Lista: id corto, mensaje, fecha, autor, estado de publicación.
 */

import type { CommitVisible, EstadoDePushVisible } from '../conexion-a-la-sala/conexion-a-la-sala.ts';
import './historial-de-versiones.css';

export function HistorialDeVersiones(props: {
  readonly commits: readonly CommitVisible[];
  readonly tipDeTrabajo?: string | null;
  readonly estadosDePush?: readonly EstadoDePushVisible[];
  /** Solo el host puede volver a una versión. */
  readonly alHacerCheckout?: (id: string) => void;
  readonly checkoutDeshabilitado?: boolean;
  /** Solo el host: publicar / reintentar. */
  readonly alPublicar?: (id: string) => void;
  readonly alReintentarPublicacion?: (id: string) => void;
  readonly publicacionDeshabilitada?: boolean;
}) {
  if (props.commits.length === 0) {
    return <p className="historial-vacio">Sin versiones aún.</p>;
  }

  const puedeCheckout = typeof props.alHacerCheckout === 'function';
  const puedePublicar = typeof props.alPublicar === 'function';
  const porCommit = new Map(
    (props.estadosDePush ?? []).map((e) => [e.commit, e] as const),
  );

  return (
    <section className="historial" aria-label="Historial de versiones">
      <h3 className="historial-titulo">Historial</h3>
      <ol className="historial-lista">
        {[...props.commits].reverse().map((c) => {
          const esTip = props.tipDeTrabajo === c.id;
          const push = porCommit.get(c.id);
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
              <p className="historial-push" aria-live="polite">
                {etiquetaDePush(push)}
              </p>
              {push?.estadoTipo === 'fallido' && push.causa ? (
                <p className="historial-push-causa" role="status">
                  {push.causa}
                </p>
              ) : null}
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
              {puedePublicar ? (
                push?.estadoTipo === 'fallido' ? (
                  <button
                    type="button"
                    className="historial-publicar"
                    disabled={props.publicacionDeshabilitada}
                    onClick={() => props.alReintentarPublicacion?.(c.id)}
                  >
                    Reintentar publicación
                  </button>
                ) : push?.estadoTipo === 'publicado' ? (
                  <p className="historial-push-ok">En el repositorio</p>
                ) : push?.estadoTipo === 'en-proceso' ? (
                  <p className="historial-push-curso">Publicando…</p>
                ) : (
                  <button
                    type="button"
                    className="historial-publicar"
                    disabled={props.publicacionDeshabilitada}
                    onClick={() => props.alPublicar?.(c.id)}
                  >
                    Publicar al repo
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function etiquetaDePush(push: EstadoDePushVisible | undefined): string {
  if (!push) return 'Publicación: sin publicar';
  if (push.estadoTipo === 'en-proceso') return 'Publicación: en proceso';
  if (push.estadoTipo === 'publicado') return 'Publicación: publicado';
  return 'Publicación: fallido';
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
