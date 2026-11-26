import type { CausaDeRechazoDeEntrada } from '@harukoia/cliente-del-relay';
import type { CausaDeAccionRechazada, CausaDeCierre, Rol, TokenDeInvitacion, TokenDeWebDelHost } from '@harukoia/domain';
import { useEffect, useRef, useState } from 'react';
import type { Editor } from 'tldraw';
import type * as Y from 'yjs';

import { type Invitacion, crearEnlace } from '../../entrada/enlace-de-invitacion/enlace-de-invitacion.ts';
import { Lienzo } from '../lienzo/lienzo.tsx';
import {
  type ConexionALaSala,
  type InstantaneaDeLaSala,
  type PresenciaDelLienzo,
  conectarALaSala,
} from '../conexion-a-la-sala/conexion-a-la-sala.ts';
import { HerramientaDeRecorte } from '../herramienta-de-recorte/herramienta-de-recorte.tsx';
import { HistorialDeVersiones } from '../historial-de-versiones/historial-de-versiones.tsx';
import { StagingDeVersion } from '../staging-de-version/staging-de-version.tsx';
import './pantalla-de-sala.css';

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
  'commit-fallido': 'No se pudo guardar la versión. Vuelve a intentar.',
  'commit-inexistente': 'Esa versión ya no existe. El tablero no cambió.',
  'checkout-fallido': 'No se pudo volver a esa versión. Vuelve a intentar.',
  'ya-publicado': 'Esa versión ya está publicada en el repositorio.',
  'publicacion-en-curso': 'Ya hay una publicación en curso para esa versión.',
  'sin-fallido-para-reintentar': 'No hay un fallo de publicación para reintentar.',
  'publicacion-no-disponible': 'No se pudo iniciar la publicación. Vuelve a intentar.',
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
  readonly urlDelHost: string;
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
    commits: [],
    tipDeTrabajo: null,
    estadosDePush: [],
  });
  const [intento, setIntento] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [guardandoVersion, setGuardandoVersion] = useState(false);
  const [haciendoCheckout, setHaciendoCheckout] = useState(false);
  const [mensajeDeVersion, setMensajeDeVersion] = useState('');
  const [linkCambiado, setLinkCambiado] = useState(false);
  const [documento, setDocumento] = useState<Y.Doc | undefined>(undefined);
  const [presencia, setPresencia] = useState<PresenciaDelLienzo | undefined>(undefined);
  const [generacion, setGeneracion] = useState(0);
  const [sincronizado, setSincronizado] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [logFallido, setLogFallido] = useState(false);
  const conexion = useRef<ConexionALaSala>(undefined);
  const alCambiarLaInvitacion = useRef(props.alCambiarLaInvitacion);
  alCambiarLaInvitacion.current = props.alCambiarLaInvitacion;

  useEffect(() => {
    setLogFallido(false);
    const abierta = conectarALaSala({
      orquestador,
      invitacion,
      nombre,
      tokenDeWebDelHost,
      alCambiar: (nueva) => {
        setInstantanea((previa) => {
          if (nueva.commits.length > previa.commits.length) {
            setGuardandoVersion(false);
            setMensajeDeVersion('');
          }
          if (nueva.tipDeTrabajo !== previa.tipDeTrabajo) {
            setHaciendoCheckout(false);
          }
          return nueva;
        });
        if (nueva.accionRechazada) {
          setCambiando(false);
          setGuardandoVersion(false);
          setHaciendoCheckout(false);
        }
      },
      alCambiarLaInvitacion: (nuevo) => {
        setCambiando(false);
        setCopiado(false);
        setLinkCambiado(true);
        alCambiarLaInvitacion.current(nuevo);
      },
      alNoGuardarElLog: () => setLogFallido(true),
    });
    conexion.current = abierta;
    setGeneracion((n) => n + 1);
    setDocumento(abierta.documento);
    setPresencia(abierta.presenciaDelLienzo());
    const dejarDeOir = abierta.alSincronizar(setSincronizado);
    return () => {
      dejarDeOir();
      abierta.salir();
      setDocumento(undefined);
      setPresencia(undefined);
      setSincronizado(false);
    };
  }, [orquestador, invitacion.sala, invitacion.tokenDeInvitacion, nombre, tokenDeWebDelHost, intento]);

  const { estado, participantes, miRol, accionRechazada, commits, tipDeTrabajo, estadosDePush } =
    instantanea;
  const enlace = crearEnlace(window.location.origin, invitacion);
  const enElTablero =
    estado.tipo === 'conectando' ||
    estado.tipo === 'conectada' ||
    estado.tipo === 'reconectando' ||
    estado.tipo === 'esperando-al-host';

  async function copiar() {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
  }

  function cambiarLink() {
    setCambiando(true);
    setLinkCambiado(false);
    conexion.current?.cambiarInvitacion();
  }

  function guardarVersion() {
    setGuardandoVersion(true);
    conexion.current?.commitear(mensajeDeVersion);
  }

  function volverAVersion(id: string) {
    setHaciendoCheckout(true);
    conexion.current?.hacerCheckout(id);
  }

  function publicarVersion(id: string) {
    conexion.current?.publicar(id);
  }

  function reintentarPublicacion(id: string) {
    conexion.current?.reintentarPublicacion(id);
  }

  return (
    <div className="sala">
      <header className="sala-barra">
        <span className="sala-marca">HaruKoia</span>
        <span className="sala-codigo" title={`Sala ${invitacion.sala}`}>
          {invitacion.sala}
        </span>
        {enElTablero ? (
          <span className={`sala-estado sala-estado-${estado.tipo}`} aria-live="polite">
            {ESTADO_VISIBLE[estado.tipo]}
          </span>
        ) : null}
        <span className="sala-orquestador" title={`Orquestador: ${new URL(orquestador).host}`}>
          {new URL(orquestador).host}
        </span>
        <span className="sala-espacio" />
        {enElTablero && participantes.length > 0 ? (
          <ul className="sala-personas" aria-label="Participantes">
            {participantes.map((p, i) => {
              const nombreVisible = p.nombre ?? '(sin nombre)';
              const rol = p.rol ? NOMBRE_DEL_ROL[p.rol] : 'sin rol';
              return (
                <li
                  key={`${nombreVisible}-${i}`}
                  className={p.soyYo ? 'sala-persona sala-persona-yo' : 'sala-persona'}
                  title={`${nombreVisible} · ${rol}${p.soyYo ? ' (tú)' : ''}`}
                >
                  <span className="sala-persona-inicial" aria-hidden="true">
                    {nombreVisible.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className="sala-persona-nombre">
                    {nombreVisible}
                    {p.soyYo ? ' (tú)' : ''}
                  </span>
                  <span className="sala-persona-rol">{rol}</span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {miRol === 'host' ? (
          <>
            <button type="button" className="sala-primario" onClick={copiar}>
              {copiado ? 'Copiado' : 'Copiar link'}
            </button>
            <button type="button" onClick={cambiarLink} disabled={cambiando || estado.tipo !== 'conectada'}>
              {cambiando ? 'Cambiando…' : 'Cambiar link'}
            </button>
          </>
        ) : null}
        <button type="button" onClick={props.alSalir}>
          Salir
        </button>
      </header>

      {estado.tipo === 'rechazada' || estado.tipo === 'sin-host' ? (
        <p className="sala-aviso" role="alert">
          {estado.tipo === 'rechazada' ? POR_QUE_NO_ENTRASTE[estado.causa] : 'La sala se cerró.'}{' '}
          <button type="button" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </p>
      ) : null}
      {estado.tipo === 'cerrada' ? (
        <p className="sala-aviso" role="alert">
          {POR_QUE_SE_CERRO[estado.causa]}
        </p>
      ) : null}
      {linkCambiado ? (
        <p className="sala-aviso" aria-live="polite">
          Link nuevo. El anterior ya no deja entrar; quienes ya están en la sala siguen dentro.
        </p>
      ) : null}
      {accionRechazada ? (
        <p className="sala-aviso" role="alert">
          {POR_QUE_NO_SE_PUDO[accionRechazada.causa]}
        </p>
      ) : null}
      {logFallido ? (
        <p className="sala-aviso" role="alert">
          Este navegador no guardó el dibujo. Si te quedas sin red, lo que dibujes ahora se puede perder.
        </p>
      ) : null}

      {enElTablero && documento && presencia ? (
        <div className="sala-cuerpo">
          <div className="sala-lienzo">
            <Lienzo
              key={generacion}
              documento={documento}
              sincronizado={sincronizado}
              sembrar={miRol === 'host'}
              presencia={presencia}
              alMontarEditor={setEditor}
            />
            {miRol === 'host' ? (
              <HerramientaDeRecorte editor={editor} urlDelHost={props.urlDelHost} tokenDeWebDelHost={tokenDeWebDelHost} />
            ) : null}
          </div>
          {miRol === 'host' ? (
            <StagingDeVersion
              mensaje={mensajeDeVersion}
              alCambiarMensaje={setMensajeDeVersion}
              participantes={participantes
                .map((p) => p.nombre)
                .filter((n): n is string => typeof n === 'string' && n.trim() !== '')}
              guardando={guardandoVersion || haciendoCheckout}
              deshabilitado={estado.tipo !== 'conectada'}
              commits={commits}
              tipDeTrabajo={tipDeTrabajo}
              estadosDePush={estadosDePush}
              alCommitear={guardarVersion}
              alHacerCheckout={volverAVersion}
              alPublicar={publicarVersion}
              alReintentarPublicacion={reintentarPublicacion}
            />
          ) : miRol === 'espectador' ? (
            <aside className="sala-panel-historial" aria-label="Historial de versiones">
              <HistorialDeVersiones
                commits={commits}
                tipDeTrabajo={tipDeTrabajo}
                estadosDePush={estadosDePush}
              />
            </aside>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
