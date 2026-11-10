/**
 * Sirve el build de Vite. La imagen lo arranca cuando `APP=web`.
 * El día a día local sigue siendo Vite con PM2; este proceso no es ese.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function dentroDeDist(pedido: string): string | undefined {
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(pedido).replace(/^[/\\]+/, '');
  } catch {
    return undefined;
  }
  const destino = join(dist, decodificado);
  const rel = relative(dist, destino);
  if (rel === '' || rel.startsWith(`..${sep}`) || rel === '..' || rel.startsWith(sep)) return undefined;
  return destino;
}

function enviar(res: ServerResponse, archivo: string, soloCabeza: boolean): void {
  const tipo = TIPOS[extname(archivo)] ?? 'application/octet-stream';
  const cache = archivo.endsWith(`${sep}index.html`) ? 'no-store' : 'public, max-age=31536000, immutable';
  res.writeHead(200, { 'content-type': tipo, 'cache-control': cache });
  if (soloCabeza) {
    res.end();
    return;
  }
  createReadStream(archivo).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');

  if (url.pathname === '/health') {
    const listo = existsSync(join(dist, 'index.html'));
    res.writeHead(listo ? 200 : 500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ service: 'web', status: listo ? 'ok' : 'sin-build' }));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  const destino = dentroDeDist(url.pathname);
  if (destino && existsSync(destino) && statSync(destino).isFile()) {
    enviar(res, destino, req.method === 'HEAD');
    return;
  }

  if (extname(url.pathname)) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  const indice = join(dist, 'index.html');
  if (!existsSync(indice)) {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'sin build' }));
    return;
  }
  enviar(res, indice, req.method === 'HEAD');
});

server.listen(port, host, () => {
  process.stdout.write(`web escuchando en http://${host}:${port}\n`);
});
