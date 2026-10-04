#!/usr/bin/env node
/**
 * Lanzador de desarrollo. PM2 → pm2-portless-run.mjs → este script.
 * El puerto llega en PORT (lo asigna portless); el proceso no lo elige.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn(process.execPath, ["--watch", resolve(appRoot, "src/main.ts")], {
  cwd: appRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
child.on("error", (err) => {
  console.error(err.message);
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
