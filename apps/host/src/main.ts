import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

import { generarIdentidadDeSala, type IdentidadDeSala } from '@harukoia/domain';

import { cambiarInvitacion } from './acciones-de-sala/cambiar-invitacion/cambiar-invitacion.ts';
import { conectarAlOrquestador } from './conexion-al-orquestador/conexion-al-orquestador.ts';
import { atenderInvitacion } from './invitacion/invitacion.ts';
import { registro } from './registro-del-proceso/registro-del-proceso.ts';
import { archivoDeLaSala } from './sala/archivo-de-la-sala.ts';
import {
  cuentaDeLaIdentidad,
  guardarIdentidad,
  identidadParaArrancar,
  leerIdentidad,
} from './sala/identidad-durable/identidad-durable.ts';
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

// La identidad se lee antes de abrir el documento y de registrarse (D2, F4).
// Una entrada ilegible termina el proceso: no se inventa otra sala.
let cuenta: string;
try {
  cuenta = cuentaDeLaIdentidad(process.env);
} catch (error) {
  registro.error('SALA_IDENTIDAD no es válida', { causa: causaDe(error) });
  process.exit(1);
}

let identidad: IdentidadDeSala;
try {
  const yaGuardada = leerIdentidad(cuenta);
  identidad = identidadParaArrancar(cuenta, generarIdentidadDeSala);
  registro.info(yaGuardada ? 'identidad de la sala restaurada' : 'identidad de la sala creada', {
    sala: identidad.sala,
  });
} catch (error) {
  registro.error('no se pudo leer la identidad de la sala', { causa: causaDe(error) });
  process.exit(1);
}

let archivoSqlite: string;
try {
  archivoSqlite = archivoDeLaSala(process.env, process.cwd());
} catch (error) {
  registro.error('SALA_SQLITE no es válida', { causa: causaDe(error) });
  process.exit(1);
}

try {
  await mkdir(path.dirname(archivoSqlite), { recursive: true });
} catch (error) {
  registro.error('no se pudo crear el directorio del documento', {
    archivo: archivoSqlite,
    causa: causaDe(error),
  });
  process.exit(1);
}

registro.info('documento de la sala en disco', { archivo: archivoSqlite });

let sala: Awaited<ReturnType<typeof abrirSalaEnVivo>>;
try {
  sala = await abrirSalaEnVivo({
    sala: identidad.sala,
    archivoSqlite,
    tokenDeWebDelHost: identidad.tokenDeWebDelHost,
    // La acción corre después del arranque: para entonces `conexion` ya existe.
    // El token nuevo se guarda cuando el orquestador ya lo confirmó (F5).
    acciones: {
      'cambiar-invitacion': cambiarInvitacion(
        identidad,
        (nuevo) => conexion.cambiarInvitacion(nuevo),
        (tokenDeInvitacion) => guardarIdentidad(cuenta, { ...identidad, tokenDeInvitacion }),
      ),
    },
    registro,
  });
} catch (error) {
  registro.error('no se pudo abrir la sala', { archivo: archivoSqlite, causa: causaDe(error) });
  process.exit(1);
}

function causaDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
