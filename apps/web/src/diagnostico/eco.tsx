import { useEffect, useRef, useState } from 'react';

import { registro } from '../registro-del-proceso/registro-del-proceso.ts';

/**
 * Diagnóstico del paso A3: confirma desde el navegador que el WebSocket cruza
 * el proxy de desarrollo. Se retira en B6, cuando la web tenga pantallas reales.
 */
const URL_DEL_ECO = import.meta.env.VITE_ORQUESTADOR_ECO_URL;

type Estado =
  | { tipo: 'conectando' }
  | { tipo: 'correcto'; vuelta: number }
  | { tipo: 'fallo'; causa: string };

export function DiagnosticoDeEco() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'conectando' });
  const [segundosAbierta, setSegundosAbierta] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!URL_DEL_ECO) {
      setEstado({ tipo: 'fallo', causa: 'falta VITE_ORQUESTADOR_ECO_URL en el .env de la web' });
      return;
    }

    const socket = new WebSocket(URL_DEL_ECO);
    socket.binaryType = 'arraybuffer';
    socketRef.current = socket;

    const enviado = crypto.getRandomValues(new Uint8Array(64));
    let inicio = 0;

    socket.addEventListener('open', () => {
      inicio = performance.now();
      registro.info('eco: conexión abierta', { destino: URL_DEL_ECO });
      socket.send(enviado);
    });

    socket.addEventListener('message', (evento) => {
      const recibido = new Uint8Array(evento.data as ArrayBuffer);
      const identico =
        recibido.length === enviado.length && recibido.every((byte, i) => byte === enviado[i]);

      const vuelta = performance.now() - inicio;

      if (identico) {
        registro.info('eco: bytes idénticos', { vuelta: Math.round(vuelta) });
        setEstado({ tipo: 'correcto', vuelta });
        return;
      }

      registro.error('eco: los bytes no volvieron idénticos', { enviados: enviado.length });
      setEstado({ tipo: 'fallo', causa: 'los bytes no volvieron idénticos' });
    });

    socket.addEventListener('error', () => {
      registro.error('eco: el navegador no pudo establecer la conexión');
      setEstado({ tipo: 'fallo', causa: 'el navegador no pudo establecer la conexión' });
    });

    socket.addEventListener('close', (evento) => {
      registro.aviso('eco: conexión cerrada', { codigo: evento.code });
      setEstado({ tipo: 'fallo', causa: `conexión cerrada con código ${evento.code}` });
    });

    const reloj = setInterval(() => setSegundosAbierta((s) => s + 1), 1000);

    return () => {
      clearInterval(reloj);
      socket.close();
      socketRef.current = null;
    };
  }, []);

  return (
    <section>
      <h2>Diagnóstico del paso A3</h2>
      <p>Eco por WebSocket a través del proxy de desarrollo.</p>
      <p>
        <strong>Destino:</strong> <code>{URL_DEL_ECO ?? 'sin configurar'}</code>
      </p>
      {estado.tipo === 'conectando' && <p>Conectando…</p>}
      {estado.tipo === 'correcto' && (
        <p>
          Eco correcto en {estado.vuelta.toFixed(1)} ms. Conexión abierta desde hace{' '}
          {segundosAbierta} s sin cortes.
        </p>
      )}
      {estado.tipo === 'fallo' && <p>Falló: {estado.causa}</p>}
    </section>
  );
}
