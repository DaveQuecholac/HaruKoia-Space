import type { CausaDeRechazoDeEntrada } from '@harukoia/cliente-del-relay';
import { useEffect, useState } from 'react';

import { type Invitacion, crearEnlace } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import type { Rol } from '../../host/rol-en-la-pestana/rol-en-la-pestana.ts';
import { type InstantaneaDeLaSala, conectarALaSala } from '../conexion-a-la-sala/conexion-a-la-sala.ts';

/** Lo que ve la persona por cada causa. Una causa nueva no compila sin su mensaje. */
const POR_QUE_NO_ENTRASTE: Record<CausaDeRechazoDeEntrada, string> = {
  'token-de-invitacion-invalido': 'El link no es válido o el host ya lo cambió. Pídele uno nuevo.',
  'sala-no-encontrada': 'La sala está cerrada: su host no está conectado.',
  'sala-ocupada-por-otro-host': 'No se pudo entrar: la sala tiene un conflicto de host.',
  'token-de-host-invalido': 'No se pudo entrar: el host de la sala no es válido.',
  'ticket-invalido': 'El host no pudo abrir tu conexión. Vuelve a intentar.',
  'emparejamiento-expirado': 'El host tardó demasiado en responder. Vuelve a intentar.',
  'mensaje-no-reconocido': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'mensaje-mal-formado': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'canal-no-soportado': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'respuesta-inesperada': 'El servidor respondió algo inesperado. Vuelve a intentar.',
};

const ESTADO_VISIBLE = {
  conectando: 'Conectando…',
  conectada: 'Conectado',
  reconectando: 'Reconectando…',
} as const;

export function PantallaDeSala(props: {
  readonly orquestador: string;
  readonly invitacion: Invitacion;
  readonly nombre: string;
  readonly rol: Rol;
  readonly alSalir: () => void;
}) {
  const { orquestador, invitacion, nombre, rol } = props;
  const [instantanea, setInstantanea] = useState<InstantaneaDeLaSala>({
    estado: { tipo: 'conectando' },
    participantes: [],
  });
  const [intento, setIntento] = useState(0);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const conexion = conectarALaSala({ orquestador, invitacion, nombre, rol, alCambiar: setInstantanea });
    return () => conexion.salir();
  }, [orquestador, invitacion.sala, invitacion.tokenDeInvitacion, nombre, rol, intento]);

  const { estado, participantes } = instantanea;
  const enlace = crearEnlace(window.location.origin, invitacion);

  async function copiar() {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
  }

  return (
    <>
      <h2>Sala {invitacion.sala}</h2>

      {estado.tipo === 'rechazada' ? (
        <p role="alert">
          {POR_QUE_NO_ENTRASTE[estado.causa]}{' '}
          <button type="button" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      ) : (
        <p aria-live="polite">Estado: {ESTADO_VISIBLE[estado.tipo]}</p>
      )}

      {rol === 'host' && (
        <section>
          <h3>Invitar</h3>
          <input readOnly value={enlace} size={70} onFocus={(e) => e.target.select()} />{' '}
          <button type="button" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>
        </section>
      )}

      <section>
        <h3>Participantes ({participantes.length})</h3>
        <ul>
          {participantes.map((p) => (
            <li key={p.cliente}>
              {p.nombre ?? '(sin nombre)'} — {p.rol ?? 'sin rol'}
              {p.soyYo && ' (tú)'}
            </li>
          ))}
        </ul>
      </section>

      <button type="button" onClick={props.alSalir}>
        Salir de la sala
      </button>
    </>
  );
}
