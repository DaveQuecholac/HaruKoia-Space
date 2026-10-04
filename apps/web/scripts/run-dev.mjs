#!/usr/bin/env node
/**
 * Lanzador de desarrollo de la web. PM2 → pm2-portless-run.mjs → este script.
 * Vite lee PORT y HOST desde el entorno en vite.config.ts; no se pasan banderas.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = resolve(appRoot, "node_modules/.bin/vite");

const child = spawn(viteBin, [], {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on("error", (err) => {
  console.error(err.message);
  console.error("Falta vite — corre pnpm install en la raíz del monorepo.");
  process.exit(1);
});

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    try {
      child.kill(sig);
    } catch {
      // ignore
    }
  });
}
