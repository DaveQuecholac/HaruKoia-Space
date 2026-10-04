import { createServer } from 'node:http';

import { registro } from './registro-del-proceso/registro-del-proceso.ts';
import { montarTunel } from './tunel/tunel.ts';

const port = Number(process.env.PORT ?? 0);
const host = process.env.HOST ?? '127.0.0.1';

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'orchestrator', status: 'ok' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

// El túnel es el único dueño de la ruta de actualización de protocolo: rechaza
// por su cuenta lo que no reconoce, así que nada más puede escuchar aquí.
const tunel = montarTunel(server, { registro });

server.listen(port, host, () => {
  const direccion = server.address();
  const puertoAsignado = direccion !== null && typeof direccion === 'object' ? direccion.port : port;
  registro.info(`escuchando en http://${host}:${puertoAsignado}`, { puerto: puertoAsignado });
});

/** Tope del apagado: si algún socket no termina su cierre, se sale igual. */
const ESPERA_DEL_APAGADO = 2_000;

let apagando = false;

function apagar(senal: string): void {
  if (apagando) return;
  apagando = true;
  registro.info('apagando', { senal, salas: tunel.salas.salasVivas() });

  tunel.cerrarConexiones();
  tunel.desmontar();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), ESPERA_DEL_APAGADO).unref();
}

process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
