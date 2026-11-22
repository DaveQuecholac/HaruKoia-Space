#!/usr/bin/env node
/**
 * PM2 helper — backend de escritura (sin portless; solo localhost).
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const APP_NAME = "harukoia-backend-escritura-dev";
const ecosystemFile = resolve(appRoot, "ecosystem.config.cjs");
const logsDir = resolve(appRoot, "logs/pm2");

function findPm2() {
  let dir = appRoot;
  for (let i = 0; i < 6; i += 1) {
    const candidate = resolve(dir, "node_modules/pm2/bin/pm2");
    if (existsSync(candidate)) return candidate;
    dir = resolve(dir, "..");
  }
  return "pm2";
}

function run(args, opts = {}) {
  const pm2 = findPm2();
  const result = spawnSync(pm2, args, {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
    shell: opts.shell ?? false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function install() {
  const pnpm = process.env.npm_execpath?.includes("pnpm") ? "pnpm" : "pnpm";
  const result = spawnSync(pnpm, ["install"], {
    cwd: resolve(appRoot, "../.."),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const comando = process.argv[2];
mkdirSync(logsDir, { recursive: true });

if (comando === "start") {
  install();
  run(["startOrReload", ecosystemFile, "--update-env"]);
  console.info(`ok: ${APP_NAME} (http://127.0.0.1:18091/ por defecto)`);
} else if (comando === "stop") {
  run(["stop", APP_NAME]);
} else if (comando === "restart") {
  install();
  run(["delete", APP_NAME]);
  run(["start", ecosystemFile, "--update-env"]);
} else if (comando === "status") {
  run(["describe", APP_NAME]);
} else if (comando === "logs") {
  run(["logs", APP_NAME]);
} else {
  console.error("uso: start | stop | restart | status | logs");
  process.exit(1);
}

// Evita import no usado si el bundler analiza pathToFileURL.
void pathToFileURL;
