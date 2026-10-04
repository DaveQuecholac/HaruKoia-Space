import { createServer } from 'node:http';

import { generarIdentidadDeSala } from '@harukoia/domain';

import { conectarAlOrquestador } from './conexion-al-orquestador/conexion-al-orquestador.ts';
import { registro } from './registro-del-proceso/registro-del-proceso.ts';

const port = Number(process.env.PORT ?? 0);
const host = process.env.HOST ?? '127.0.0.1';
const urlDelOrquestador = process.env.ORQUESTADOR_URL;

if (!urlDelOrquestador) {
  // Falta de configuración, no fallo de red: esto sí termina el proceso.
  registro.error('falta ORQUESTADOR_URL en el entorno del host', {
    ejemplo: 'wss://orquestador.harukoia.local.iokoia.dev',
  });
  process.exit(1);
}

// En H1 la sala vive en memoria: reiniciar el host crea una sala y un link
// nuevos. La persistencia es H3.
const identidad = generarIdentidadDeSala();

// Solo desarrollo, decisión de B4: hasta que B6 dé la pantalla de invitar, es
// la única forma de obtener el token. Queda en el log de PM2. El token de host
// no se imprime nunca.
registro.aviso('solo desarrollo: invitación de la sala', {
  sala: identidad.sala,
  tokenDeInvitacion: identidad.tokenDeInvitacion,
});

const conexion = conectarAlOrquestador({
  url: urlDelOrquestador,
  identidad,
  registro,
  manejadores: {
    // B5 enchufa aquí la sala en vivo. Hasta entonces el invitado queda
    // conectado y sus bytes no se procesan.
    sesion: (datos) => {
      datos.registro.info('sin sala en vivo todavía: los datos no se procesan hasta B5');
    },
  },
});

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'host', status: 'ok' }));
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, host, () => {
  const direccion = server.address();
  const puertoAsignado = direccion !== null && typeof direccion === 'object' ? direccion.port : port;
  registro.info(`escuchando en http://${host}:${puertoAsignado}`, { puerto: puertoAsignado });
});

async function apagar(senal: string): Promise<void> {
  registro.info('apagando', { senal });
  await conexion.detener();
  server.close();
  process.exit(0);
}

process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));
