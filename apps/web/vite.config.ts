import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// PM2 + portless asignan PORT y HOST. Sin ellos, Vite usa su puerto por defecto.
const port = process.env.PORT ? Number(process.env.PORT) : undefined;
const host = process.env.HOST ?? '127.0.0.1';

export default defineConfig({
  plugins: [react()],
  server: {
    host,
    ...(port ? { port, strictPort: true } : {}),
    // El proxy portless entra por el hostname público.
    allowedHosts: ['.local.iokoia.dev', '.localhost'],
  },
});
