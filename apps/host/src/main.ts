import { createServer } from 'node:http';

import { registro } from './registro-del-proceso/registro-del-proceso.ts';

const port = Number(process.env.PORT ?? 0);
const host = process.env.HOST ?? '127.0.0.1';

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
