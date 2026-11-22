/**
 * Staging de versión (H4 / V3): preparar el **commit** de toda la pizarra.
 * Solo lo ve el host. No filtra formas (D-H4-1).
 * Copy: commit = versión oficial (historial + réplica), no un borrador.
 * El historial vive en su propio componente (V4).
 */

import { HistorialDeVersiones } from '../historial-de-versiones/historial-de-versiones.tsx';
import type { CommitVisible } from '../conexion-a-la-sala/conexion-a-la-sala.ts';
import './staging-de-version.css';

export function StagingDeVersion(props: {
  readonly mensaje: string;
  readonly alCambiarMensaje: (mensaje: string) => void;
  readonly participantes: readonly string[];
  readonly guardando: boolean;
  readonly deshabilitado: boolean;
  readonly commits: readonly CommitVisible[];
  readonly tipDeTrabajo: string | null;
  readonly alCommitear: () => void;
  readonly alHacerCheckout: (id: string) => void;
}) {
  return (
    <aside className="staging" aria-label="Crear versión">
      <h2 className="staging-titulo">Crear versión</h2>
      <p className="staging-ayuda">
        Versión oficial de toda la pizarra: entra al historial y a la réplica. No es un borrador.
      </p>
      <label className="staging-campo">
        <span>Mensaje</span>
        <input
          type="text"
          value={props.mensaje}
          onChange={(e) => props.alCambiarMensaje(e.target.value)}
          placeholder="Qué cambió en esta versión"
          disabled={props.guardando || props.deshabilitado}
        />
      </label>
      <p className="staging-presentes">
        Participantes ahora:{' '}
        {props.participantes.length > 0 ? props.participantes.join(', ') : '(nadie más)'}
      </p>
      <button
        type="button"
        className="staging-guardar"
        onClick={props.alCommitear}
        disabled={props.guardando || props.deshabilitado}
      >
        {props.guardando ? 'Commiteando…' : 'Commitear'}
      </button>
      <HistorialDeVersiones
        commits={props.commits}
        tipDeTrabajo={props.tipDeTrabajo}
        alHacerCheckout={props.alHacerCheckout}
        checkoutDeshabilitado={props.guardando || props.deshabilitado}
      />
    </aside>
  );
}
