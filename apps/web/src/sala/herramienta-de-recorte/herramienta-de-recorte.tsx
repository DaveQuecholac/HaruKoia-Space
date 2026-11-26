/**
 * Herramienta de recorte (H6 / A). Solo la monta el host.
 * El rectángulo es una capa encima de la pizarra. No crea formas en el tablero.
 */

import { useRef, useState, type PointerEvent } from 'react';
import type { Editor } from 'tldraw';

import { rasterDeLaZona } from './imagen-de-zona.ts';
import { pedirConversion } from './pedir-conversion.ts';
import { pedirInterpretacion } from './pedir-interpretacion.ts';
import { pedirRasterDelLienzo } from './pedir-raster-del-lienzo.ts';
import {
  type PuntoDeRecorte,
  type RectanguloDeRecorte,
  type SesionDeRecorte,
  SESION_DE_RECORTE_CERRADA,
  abrirHerramienta,
  cerrarHerramienta,
  enmarcar,
  marcoVisible,
  nombrarDocumento,
  rectanguloDesdeArrastre,
} from './rectangulo-de-recorte.ts';
import './herramienta-de-recorte.css';

export function HerramientaDeRecorte(props: {
  readonly editor: Editor | null;
  readonly urlDelHost: string;
  readonly tokenDeWebDelHost: string | undefined;
}) {
  const [sesion, setSesion] = useState<SesionDeRecorte>(SESION_DE_RECORTE_CERRADA);
  const [vista, setVista] = useState<string | null>(null);
  const [tomando, setTomando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [interpretando, setInterpretando] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [falloInterpretacion, setFalloInterpretacion] = useState(false);
  const [sinNombre, setSinNombre] = useState(false);
  const [rutaGuardada, setRutaGuardada] = useState<string | null>(null);
  const [wordGuardado, setWordGuardado] = useState<string | null>(null);
  const [pdfGuardado, setPdfGuardado] = useState<string | null>(null);
  const [falloConversion, setFalloConversion] = useState(false);
  const capa = useRef<HTMLDivElement>(null);
  const inicio = useRef<PuntoDeRecorte | null>(null);
  const rectanguloActual = useRef<RectanguloDeRecorte | null>(null);
  const vistaActual = useRef<string | null>(null);
  const imagenActual = useRef<Blob | null>(null);
  const turno = useRef(0);
  const editorActual = useRef(props.editor);
  editorActual.current = props.editor;

  function punto(evento: PointerEvent<HTMLDivElement>): PuntoDeRecorte {
    const caja = capa.current?.getBoundingClientRect();
    if (!caja) return { x: 0, y: 0 };
    return { x: evento.clientX - caja.left, y: evento.clientY - caja.top };
  }

  function alBajar(evento: PointerEvent<HTMLDivElement>) {
    if (evento.button !== 0) return;
    if (evento.isTrusted) evento.currentTarget.setPointerCapture(evento.pointerId);
    inicio.current = punto(evento);
  }

  function alMover(evento: PointerEvent<HTMLDivElement>) {
    if (!inicio.current) return;
    const rectangulo = rectanguloDesdeArrastre(inicio.current, punto(evento));
    if (!rectangulo) return;
    rectanguloActual.current = rectangulo;
    setSesion((actual) => enmarcar(actual, rectangulo));
  }

  function soltarVista() {
    if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
    vistaActual.current = null;
    imagenActual.current = null;
    setVista(null);
    setMarkdown(null);
    setFalloInterpretacion(false);
    setSinNombre(false);
    setRutaGuardada(null);
    setWordGuardado(null);
    setPdfGuardado(null);
    setFalloConversion(false);
    setInterpretando(false);
  }

  async function tomarZona(rectangulo: RectanguloDeRecorte) {
    const editor = editorActual.current;
    const caja = capa.current?.getBoundingClientRect();
    if (!editor || !caja) return;
    const id = ++turno.current;
    setTomando(true);
    setFallo(false);
    setMarkdown(null);
    setFalloInterpretacion(false);
    setSinNombre(false);
    setRutaGuardada(null);
    setWordGuardado(null);
    setPdfGuardado(null);
    setFalloConversion(false);
    const origen = editor.screenToPage({ x: caja.left + rectangulo.x, y: caja.top + rectangulo.y });
    const opuesto = editor.screenToPage({
      x: caja.left + rectangulo.x + rectangulo.ancho,
      y: caja.top + rectangulo.y + rectangulo.alto,
    });
    try {
      const blob = await rasterDeLaZona((pedido) => pedirRasterDelLienzo(editor, pedido), origen, opuesto);
      if (turno.current !== id) return;
      if (!blob) {
        setFallo(true);
        return;
      }
      if (vistaActual.current) URL.revokeObjectURL(vistaActual.current);
      const url = URL.createObjectURL(blob);
      vistaActual.current = url;
      imagenActual.current = blob;
      setVista(url);
    } catch {
      if (turno.current === id) setFallo(true);
    } finally {
      if (turno.current === id) setTomando(false);
    }
  }

  async function interpretar() {
    const imagen = imagenActual.current;
    if (!imagen) return;
    if (sesion.nombre.trim() === '') {
      setSinNombre(true);
      setFalloInterpretacion(false);
      return;
    }
    const id = turno.current;
    setInterpretando(true);
    setFalloInterpretacion(false);
    setSinNombre(false);
    const resultado = await pedirInterpretacion({
      urlDelHost: props.urlDelHost,
      tokenDeWebDelHost: props.tokenDeWebDelHost,
      nombre: sesion.nombre,
      imagen,
    });
    if (turno.current !== id) return;
    setInterpretando(false);
    if (resultado.ok) {
      setMarkdown(resultado.markdown);
      setRutaGuardada(resultado.ruta);
      setWordGuardado(resultado.word);
      setPdfGuardado(resultado.pdf);
      setFalloConversion(resultado.word === null || resultado.pdf === null);
    } else setFalloInterpretacion(true);
  }

  async function reintentar() {
    if (!rutaGuardada) return;
    const id = turno.current;
    setInterpretando(true);
    setFalloConversion(false);
    const resultado = await pedirConversion({
      urlDelHost: props.urlDelHost,
      tokenDeWebDelHost: props.tokenDeWebDelHost,
      ruta: rutaGuardada,
    });
    if (turno.current !== id) return;
    setInterpretando(false);
    if (resultado.ok) {
      setWordGuardado(resultado.word);
      setPdfGuardado(resultado.pdf);
    } else setFalloConversion(true);
  }

  function alSoltar() {
    const rectangulo = rectanguloActual.current;
    inicio.current = null;
    if (rectangulo) void tomarZona(rectangulo);
  }

  function cerrar() {
    turno.current += 1;
    rectanguloActual.current = null;
    soltarVista();
    setTomando(false);
    setFallo(false);
    setSesion(cerrarHerramienta());
  }

  return (
    <div className="herramienta-de-recorte">
      {sesion.abierta ? (
        <>
          <div
            ref={capa}
            className="herramienta-de-recorte-capa"
            role="application"
            aria-label="Zona a interpretar"
            onPointerDown={alBajar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
          >
            {marcoVisible(sesion) && sesion.rectangulo ? (
              <div
                className="herramienta-de-recorte-marco"
                style={{
                  left: sesion.rectangulo.x,
                  top: sesion.rectangulo.y,
                  width: sesion.rectangulo.ancho,
                  height: sesion.rectangulo.alto,
                }}
              />
            ) : null}
          </div>
          <form
            className="herramienta-de-recorte-panel"
            aria-label="Interpretar zona"
            onSubmit={(evento) => evento.preventDefault()}
          >
            <label className="herramienta-de-recorte-campo">
              <span>Nombre del documento</span>
              <input
                type="text"
                value={sesion.nombre}
                onChange={(evento) => setSesion((actual) => nombrarDocumento(actual, evento.target.value))}
                placeholder="Cómo se va a llamar"
              />
            </label>
            <button type="button" onClick={cerrar}>
              Cerrar
            </button>
            {vista ? (
              <button type="button" className="herramienta-de-recorte-interpretar" onClick={() => void interpretar()} disabled={interpretando}>
                {interpretando ? 'Guardando…' : 'Generar y guardar'}
              </button>
            ) : null}
            {tomando ? <p className="herramienta-de-recorte-estado">Tomando la zona…</p> : null}
            {fallo ? <p className="herramienta-de-recorte-estado">No se pudo tomar la imagen de la zona.</p> : null}
            {sinNombre ? <p className="herramienta-de-recorte-estado">Ponle un nombre al documento.</p> : null}
            {falloInterpretacion ? (
              <p className="herramienta-de-recorte-estado">No se pudo guardar el documento. No quedó archivo.</p>
            ) : null}
            {rutaGuardada ? <p className="herramienta-de-recorte-estado">Guardado en {rutaGuardada}</p> : null}
            {wordGuardado ? <p className="herramienta-de-recorte-estado">Word en {wordGuardado}</p> : null}
            {pdfGuardado ? <p className="herramienta-de-recorte-estado">PDF en {pdfGuardado}</p> : null}
            {falloConversion ? (
              <>
                <p className="herramienta-de-recorte-estado">El Markdown quedó. Word y PDF no se generaron.</p>
                <button type="button" onClick={() => void reintentar()} disabled={interpretando}>
                  Reintentar Word y PDF
                </button>
              </>
            ) : null}
            {vista ? <img className="herramienta-de-recorte-vista" alt="Zona enmarcada" src={vista} /> : null}
            {markdown ? <pre className="herramienta-de-recorte-markdown">{markdown}</pre> : null}
          </form>
        </>
      ) : (
        <button type="button" className="herramienta-de-recorte-abrir" onClick={() => setSesion((actual) => abrirHerramienta(actual))}>
          Interpretar zona
        </button>
      )}
    </div>
  );
}
