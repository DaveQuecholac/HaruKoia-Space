#!/usr/bin/env node
/**
 * Orquestador PM2 de la raíz — arranca las apps del motor bajo PM2 + portless.
 *
 * Kit canónico: @iokoia/devcli → templates/pm2_portless/pm2-root-dev.mjs
 *
 * Uso:
 *   node scripts/pm2-root-dev.mjs start    # arranca todas las apps (sin follow)
 *   node scripts/pm2-root-dev.mjs stop     # apaga todas
 *   node scripts/pm2-root-dev.mjs status
 *   node scripts/pm2-root-dev.mjs logs     # follow de logs (Ctrl+C no apaga)
 *   node scripts/pm2-root-dev.mjs restart
 *
 * Agente: usar start/stop/status/restart — nunca `pnpm dev` ni el follow de logs.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

/**
 * Apps PM2 + portless. Cada paquete es dueño de su pm2-dev y su ecosystem.
 * @type {{ name: string, filter: string }[]}
 */
const APPS = [
  { name: "orchestrator", filter: "@harukoia/orchestrator" },
  { name: "host", filter: "@harukoia/host" },
  { name: "web", filter: "@harukoia/web" },
];

const pnpmResolver = resolve(repoRoot, "scripts/resolve-pnpm-for-spawn.mjs");
const command = process.argv[2];

async function loadPnpm() {
  if (existsSync(pnpmResolver)) {
    const mod = await import(pathToFileURL(pnpmResolver).href);
    if (typeof mod.resolvePnpmForSpawn === "function") {
      return mod.resolvePnpmForSpawn();
    }
  }
  return { command: "pnpm", shell: process.platform === "win32" };
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    shell: opts.shell ?? false,
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runApps(pnpm, script) {
  for (const app of APPS) {
    console.log(`App ${script}: ${app.name}...`);
    run(pnpm.command, ["--filter", app.filter, "run", script], {
      shell: pnpm.shell,
    });
  }
}

async function main() {
  if (!command || !["start", "stop", "status", "logs", "restart"].includes(command)) {
    console.error("Uso: node scripts/pm2-root-dev.mjs <start|stop|restart|logs|status>");
    process.exit(2);
  }

  const pnpm = await loadPnpm();

  switch (command) {
    case "start":
      runApps(pnpm, "dev:start");
      console.log(
        "\npm2-root-dev: apps arriba bajo PM2. Logs: node scripts/pm2-root-dev.mjs logs — apagar: node scripts/pm2-root-dev.mjs stop",
      );
      break;

    case "stop":
      runApps(pnpm, "dev:stop");
      console.log("\npm2-root-dev: apps apagadas.");
      break;

    case "restart":
      runApps(pnpm, "dev:stop");
      runApps(pnpm, "dev:start");
      break;

    case "status":
      runApps(pnpm, "dev:status");
      break;

    case "logs": {
      const names = APPS.map((a) => a.name).join(",");
      const colors = APPS.map(
        (_, i) => ["cyan", "magenta", "green", "yellow", "blue", "red"][i % 6],
      ).join(",");
      console.log(
        "Siguiendo logs PM2 (Ctrl+C solo corta el follow — para apagar: node scripts/pm2-root-dev.mjs stop)...",
      );
      run(
        pnpm.command,
        [
          "exec",
          "concurrently",
          // Sin -k: si un stream muere, no debe matar el follow de las demás apps.
          "-n",
          names,
          "-c",
          colors,
          ...APPS.map((a) => `pnpm --filter ${a.filter} run dev:logs`),
        ],
        { shell: pnpm.shell },
      );
      break;
    }

    default:
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
