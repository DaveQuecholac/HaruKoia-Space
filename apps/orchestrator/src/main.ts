import { createServer } from 'node:http';

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

server.listen(port, host, () => {
  console.log(`orchestrator escuchando en http://${host}:${port}`);
});
