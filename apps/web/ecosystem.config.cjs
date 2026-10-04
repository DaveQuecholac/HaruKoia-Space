/**
 * PM2 ecosystem — app detrás del proxy portless (registra ruta, sin CLI portless).
 *
 * Kit canónico: @iokoia/devcli → templates/pm2_portless/ecosystem.config.cjs
 * APP_NAME y PORTLESS_NAME deben coincidir con scripts/pm2-dev.mjs.
 *
 * Camino: PM2 → node → pm2-portless-run.mjs → scripts/run-dev.mjs
 * Registra hostname→PORT en ~/.portless/routes.json; el proxy ya debe estar corriendo.
 *
 * Requiere: proxy portless arriba (`iokoia install portless`).
 */
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

/** Debe coincidir con APP_NAME en scripts/pm2-dev.mjs */
const APP_NAME = "harukoia-web-dev";
/** Ruta portless (sin el TLD). URL = https://<PORTLESS_NAME>.dev/ */
const PORTLESS_NAME = "web.harukoia.local.iokoia";
const appDir = __dirname;

const portlessRunCandidates = [
  resolve(appDir, "../../scripts/pm2-portless-run.mjs"),
  resolve(appDir, "scripts/pm2-portless-run.mjs"),
];
const portlessRun =
  portlessRunCandidates.find((p) => existsSync(p)) ||
  resolve(appDir, "scripts/pm2-portless-run.mjs");

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return env;
}

const fileEnv = {
  ...loadEnvFile(resolve(appDir, ".env")),
  ...loadEnvFile(resolve(appDir, ".env.local")),
};

const launcher = resolve(appDir, "scripts/run-dev.mjs");

if (!existsSync(portlessRun)) {
  throw new Error(
    `Falta pm2-portless-run.mjs (busqué en ${portlessRunCandidates.join(", ")}).`,
  );
}

module.exports = {
  apps: [
    {
      name: APP_NAME,
      cwd: appDir,
      script: process.execPath,
      // args como arreglo — obligatorio (rutas con espacios en Windows).
      args: [portlessRun, PORTLESS_NAME, launcher],
      interpreter: "none",
      windowsHide: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "5s",
      out_file: resolve(appDir, "logs/pm2/out.log"),
      error_file: resolve(appDir, "logs/pm2/error.log"),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: "development",
        // No definir PORT: pm2-portless-run lo asigna y lo registra en el proxy.
        ...Object.fromEntries(
          Object.entries(fileEnv).filter(([key]) => key !== "PORT"),
        ),
      },
    },
  ],
};
