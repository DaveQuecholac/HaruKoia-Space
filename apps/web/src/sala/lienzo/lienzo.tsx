import { useEffect, useRef, useState } from 'react';
import { Tldraw, createTLStore } from 'tldraw';
import 'tldraw/tldraw.css';
import type * as Y from 'yjs';

import type { PresenciaDelLienzo } from '../conexion-a-la-sala/conexion-a-la-sala.ts';
import { seguirPresencia } from './presencia-del-lienzo.ts';
import { type EnlaceDelTablero, type SesionDelTablero, enlazarTablero } from './tablero-en-el-documento.ts';

/**
 * Lienzo de la sala. Las formas viven en el documento Yjs de la conexión.
 *
 * El enlace se abre en el efecto y se cierra al desmontar. En desarrollo
 * React monta, desmonta y vuelve a montar: si la suscripción quedara en el
 * estado inicial, el segundo montaje seguiría con el mapa ya cerrado y el
 * dibujo solo aparecería al recargar.
 */
export function Lienzo(props: {
  readonly documento: Y.Doc;
  readonly sincronizado: boolean;
  /** El host escribe el tablero vacío. Quien entra después solo lee. */
  readonly sembrar: boolean;
  /** El awareness de esta conexión. El nombre ya está ahí. */
  readonly presencia: PresenciaDelLienzo;
}) {
  const { documento, sincronizado, sembrar, presencia } = props;
  const [store] = useState(() => createTLStore());
  const enlace = useRef<EnlaceDelTablero | undefined>(undefined);
  const editorListo = useRef(false);
  const dejarPresencia = useRef<(() => void) | undefined>(undefined);
  const sesion = useRef<SesionDelTablero>({ sincronizado, sembrar });
  const presenciaActual = useRef(presencia);
  sesion.current = { sincronizado, sembrar };
  presenciaActual.current = presencia;

  useEffect(() => {
    const creado = enlazarTablero(store, documento, () => {});
    enlace.current = creado;
    creado.alCambiarLaSesion(sesion.current);
    if (editorListo.current) creado.editorMontado();
    return () => {
      dejarPresencia.current?.();
      dejarPresencia.current = undefined;
      creado.cerrar();
      if (enlace.current === creado) enlace.current = undefined;
    };
  }, [store, documento]);

  useEffect(() => {
    enlace.current?.alCambiarLaSesion({ sincronizado, sembrar });
  }, [sincronizado, sembrar]);

  return (
    <div className="sala-lienzo-tldraw">
      <Tldraw
        store={store}
        onMount={(editor) => {
          editorListo.current = true;
          enlace.current?.editorMontado();
          dejarPresencia.current?.();
          dejarPresencia.current = seguirPresencia(editor, presenciaActual.current);
        }}
      />
    </div>
  );
}
