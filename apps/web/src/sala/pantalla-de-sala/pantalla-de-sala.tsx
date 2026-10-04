import type { CausaDeRechazoDeEntrada } from '@harukoia/cliente-del-relay';
import type { CausaDeAccionRechazada, CausaDeCierre, Rol, TokenDeInvitacion, TokenDeWebDelHost } from '@harukoia/domain';
import { useEffect, useRef, useState } from 'react';

import { type Invitacion, crearEnlace } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import {
  type ConexionALaSala,
  type InstantaneaDeLaSala,
  conectarALaSala,
} from '../conexion-a-la-sala/conexion-a-la-sala.ts';

/** Lo que ve la persona por cada causa. Una causa nueva no compila sin su mensaje. */
const POR_QUE_NO_ENTRASTE: Record<CausaDeRechazoDeEntrada, string> = {
  'token-de-invitacion-invalido': 'El link no es válido o el host ya lo cambió. Pídele uno nuevo.',
  'sala-no-encontrada':
    'La sala no está abierta en este orquestador: su host no está conectado, o está registrado en otro orquestador.',
  'sala-ocupada-por-otro-host': 'No se pudo entrar: la sala tiene un conflicto de host.',
  'token-de-host-invalido': 'No se pudo entrar: el host de la sala no es válido.',
  'ticket-invalido': 'El host no pudo abrir tu conexión. Vuelve a intentar.',
  'emparejamiento-expirado': 'El host tardó demasiado en responder. Vuelve a intentar.',
  'mensaje-no-reconocido': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'mensaje-mal-formado': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'canal-no-soportado': 'Esta web y el servidor no se entienden: la versión no coincide.',
  'respuesta-inesperada': 'El servidor respondió algo inesperado. Vuelve a intentar.',
};

/** Por qué se cerró una sala en la que ya estabas. */
const POR_QUE_SE_CERRO: Record<CausaDeCierre, string> = {
  'host-cerro-la-sala': 'El host cerró la sala.',
  'host-sin-latido': 'El host dejó de responder y la sala se cerró.',
  'host-reemplazado': 'Otro host tomó la sala.',
};

/** Por qué el host no aceptó una acción. */
const POR_QUE_NO_SE_PUDO: Record<CausaDeAccionRechazada, string> = {
  'rol-insuficiente': 'Solo el host puede hacer eso.',
  'orquestador-no-disponible': 'El orquestador no respondió y el link no cambió. Vuelve a intentar.',
};

const NOMBRE_DEL_ROL: Record<Rol, string> = {
  host: 'host',
  espectador: 'espectador',
};

const ESTADO_VISIBLE = {
  conectando: 'Conectando…',
  conectada: 'Conectado',
  reconectando: 'Reconectando…',
  'esperando-al-host': 'Esperando al host…',
} as const;

export function PantallaDeSala(props: {
  readonly orquestador: string;
  readonly invitacion: Invitacion;
  readonly nombre: string;
  readonly tokenDeWebDelHost: TokenDeWebDelHost | undefined;
  readonly alCambiarLaInvitacion: (tokenDeInvitacion: TokenDeInvitacion) => void;
  readonly alSalir: () => void;
}) {
  const { orquestador, invitacion, nombre, tokenDeWebDelHost } = props;
  const [instantanea, setInstantanea] = useState<InstantaneaDeLaSala>({
    estado: { tipo: 'conectando' },
    participantes: [],
    miRol: undefined,
    accionRechazada: undefined,
  });
  const [intento, setIntento] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [linkCambiado, setLinkCambiado] = useState(false);
  const conexion = useRef<ConexionALaSala>(undefined);
  const alCambiarLaInvitacion = useRef(props.alCambiarLaInvitacion);
  alCambiarLaInvitacion.current = props.alCambiarLaInvitacion;

  useEffect(() => {
    const abierta = conectarALaSala({
      orquestador,
      invitacion,
      nombre,
      tokenDeWebDelHost,
      alCambiar: (nueva) => {
        setInstantanea(nueva);
        if (nueva.accionRechazada) setCambiando(false);
      },
      alCambiarLaInvitacion: (nuevo) => {
        setCambiando(false);
        setCopiado(false);
        setLinkCambiado(true);
        alCambiarLaInvitacion.current(nuevo);
      },
    });
    conexion.current = abierta;
    return () => abierta.salir();
  }, [orquestador, invitacion.sala, invitacion.tokenDeInvitacion, nombre, tokenDeWebDelHost, intento]);

  const { estado, participantes, miRol, accionRechazada } = instantanea;
  const enlace = crearEnlace(window.location.origin, invitacion);

  async function copiar() {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
  }

  function cambiarLink() {
    setCambiando(true);
    setLinkCambiado(false);
    conexion.current?.cambiarInvitacion();
  }

  return (
    <>
      <h2>Sala {invitacion.sala}</h2>

      {estado.tipo === 'rechazada' || estado.tipo === 'sin-host' ? (
        <p role="alert">
          {estado.tipo === 'rechazada' ? POR_QUE_NO_ENTRASTE[estado.causa] : 'La sala se cerró.'}{' '}
          <button type="button" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      ) : estado.tipo === 'cerrada' ? (
        <p role="alert">{POR_QUE_SE_CERRO[estado.causa]}</p>
      ) : (
        <p aria-live="polite">Estado: {ESTADO_VISIBLE[estado.tipo]}</p>
      )}
      <p>
        <small>Orquestador: {new URL(orquestador).host}</small>
      </p>

      {miRol === 'host' && (
        <section>
          <h3>Invitar</h3>
          <input readOnly value={enlace} size={70} onFocus={(e) => e.target.select()} />{' '}
          <button type="button" onClick={copiar}>
            {copiado ? 'Copiado' : 'Copiar link'}
          </button>{' '}
          <button type="button" onClick={cambiarLink} disabled={cambiando || estado.tipo !== 'conectada'}>
            {cambiando ? 'Cambiando…' : 'Cambiar link'}
          </button>
          {linkCambiado && (
            <p aria-live="polite">
              Link nuevo. El anterior ya no deja entrar; quienes ya están en la sala siguen dentro.
            </p>
          )}
          {accionRechazada && <p role="alert">{POR_QUE_NO_SE_PUDO[accionRechazada.causa]}</p>}
        </section>
      )}

      {(estado.tipo === 'conectando' ||
        estado.tipo === 'conectada' ||
        estado.tipo === 'reconectando' ||
        estado.tipo === 'esperando-al-host') && (
        <section>
          <h3>Participantes ({participantes.length})</h3>
          <ul>
            {participantes.map((p) => (
              <li key={p.cliente}>
                {p.nombre ?? '(sin nombre)'} — {p.rol ? NOMBRE_DEL_ROL[p.rol] : 'sin rol'}
                {p.soyYo && ' (tú)'}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={props.alSalir}>
        Salir de la sala
      </button>
    </>
  );
}
