import { createServer } from 'node:http';

import { generarIdentidadDeSala } from '@harukoia/domain';

import { cambiarInvitacion } from './acciones-de-sala/cambiar-invitacion/cambiar-invitacion.ts';
import { conectarAlOrquestador } from './conexion-al-orquestador/conexion-al-orquestador.ts';
import { atenderInvitacion } from './invitacion/invitacion.ts';
import { registro } from './registro-del-proceso/registro-del-proceso.ts';
import { abrirSalaEnVivo } from './sala/sala.ts';

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

const sala = await abrirSalaEnVivo({
  sala: identidad.sala,
  tokenDeWebDelHost: identidad.tokenDeWebDelHost,
  // La acción corre después del arranque: para entonces `conexion` ya existe.
  acciones: { 'cambiar-invitacion': cambiarInvitacion(identidad, (nuevo) => conexion.cambiarInvitacion(nuevo)) },
  registro,
});

const conexion = conectarAlOrquestador({
  url: urlDelOrquestador,
  identidad,
  registro,
  manejadores: { sesion: sala.manejador },
});

const origenDeLaWeb = process.env.WEB_ORIGEN;
const invitacionVigente = conexion.invitacionVigente;

const server = createServer((req, res) => {
  if (origenDeLaWeb && atenderInvitacion(req, res, { identidad, invitacionVigente, origenDeLaWeb })) return;
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
  await sala.cerrar();
  server.close();
  process.exit(0);
}

process.once('SIGTERM', () => void apagar('SIGTERM'));
process.once('SIGINT', () => void apagar('SIGINT'));
