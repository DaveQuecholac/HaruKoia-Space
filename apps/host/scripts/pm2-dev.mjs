#!/usr/bin/env node
/**
 * PM2 helper — app behind portless proxy (via pm2-portless-run, not portless CLI).
 *
 * Copy to: <app>/scripts/pm2-dev.mjs
 * Also need: pm2-cli-util.mjs (same folder or <repo>/scripts/) — see resolveUtil below.
 * Set APP_NAME and PORTLESS_NAME to match ecosystem.config.cjs.
 *
 * Cross-platform (Windows / macOS / Linux). Ctrl+C on `pnpm dev` only stops
 * log follow — use `dev:stop` to stop the PM2 process.
 *
 * start / restart: `pnpm install` first, then PM2 (keeps deps/lockfile in sync).
 *
 * Monorepo: prefer a **single** `pm2` version at the **repo root**; this helper
 * walks up to resolve `node_modules/pm2`. After install: `pnpm exec pm2 update` once.
 */
import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
/** Must match `name` in ecosystem.config.cjs */
const APP_NAME = "harukoia-host-dev";
/** Portless route name (no public TLD). URL = https://<PORTLESS_NAME>.dev/ when proxy TLD is `.dev` */
const PORTLESS_NAME = "host.harukoia.local.iokoia";
const PUBLIC_URL = `https://${PORTLESS_NAME}.dev/`;
const ecosystemFile = resolve(appRoot, "ecosystem.config.cjs");
const logsDir = resolve(appRoot, "logs/pm2");

/** @type {typeof import("./pm2-cli-util.mjs") | null} */
let util = null;

async function loadUtil() {
  if (util) return util;
  const candidates = [
    resolve(__dirname, "pm2-cli-util.mjs"),
    resolve(appRoot, "scripts/pm2-cli-util.mjs"),
    resolve(appRoot, "../scripts/pm2-cli-util.mjs"),
    resolve(appRoot, "../../scripts/pm2-cli-util.mjs"),
    resolve(appRoot, "../../../scripts/pm2-cli-util.mjs"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      util = await import(pathToFileURL(p).href);
      return util;
    }
  }
  console.error(
    "Missing pm2-cli-util.mjs (copy from @iokoia/devcli templates/pm2_portless/).",
  );
  process.exit(1);
}

function pm2Bin() {
  return util.resolvePm2Bin(appRoot);
}

function runPm2(args, options = {}) {
  const result = spawnSync(process.execPath, [pm2Bin(), ...args], {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
    ...options,
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function listPm2() {
  return util.listPm2Processes(pm2Bin(), appRoot);
}

function findEntry() {
  return listPm2().find((entry) => entry.name === APP_NAME) ?? null;
}

function isRegistered() {
  return findEntry() !== null;
}

function isRunning() {
  return util.isPm2NameOnline(pm2Bin(), appRoot, APP_NAME);
}

function ensureLogsDir() {
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

function ensureEnvFile() {
  const envPath = resolve(appRoot, ".env");
  const envLocalPath = resolve(appRoot, ".env.local");
  if (!existsSync(envPath) && !existsSync(envLocalPath)) {
    console.error(
      "Missing .env or .env.local — copy .env.example and configure it.",
    );
    process.exit(1);
  }
}

/** Sync deps before PM2 so lockfile / links updates apply on every start|restart. */
function ensurePnpmInstall() {
  console.log("Running pnpm install…");
  const result = spawnSync("pnpm", ["install"], {
    cwd: appRoot,
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });

  if (result.error) {
    console.error(result.error.message);
    console.error("pnpm is required on PATH (package manager for this repo).");
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error("pnpm install failed — fix dependencies before starting PM2.");
    process.exit(result.status ?? 1);
  }
}

function ensurePortlessProxy() {
  const stateDir =
    process.env.PORTLESS_STATE_DIR?.trim() || join(homedir(), ".portless");
  const proxyPort = join(stateDir, "proxy.port");
  const proxyPid = join(stateDir, "proxy.pid");
  if (!existsSync(proxyPort) && !existsSync(proxyPid)) {
    console.error(
      "portless proxy does not look running (missing ~/.portless/proxy.port).",
    );
    console.error(
      "Preferred: iokoia install portless  (OS service; also: iokdev install portless)",
    );
    console.error(
      "Manual: portless service install   (or one-shot: portless proxy start)",
    );
    process.exit(1);
  }

  const routesPath = join(stateDir, "routes.json");
  const probeTarget = existsSync(routesPath) ? routesPath : stateDir;
  try {
    accessSync(probeTarget, fsConstants.W_OK);
  } catch {
    console.error(`Cannot write portless state (${probeTarget}).`);
    console.error(
      "The user running PM2 must own/write ~/.portless (routes.json).",
    );
    console.error(
      "If the proxy was started as root (port 443), fix ownership, e.g.:",
    );
    console.error(`  sudo chown -R "$(whoami):$(whoami)" "${stateDir}"`);
    console.error("Or run the proxy on a non-privileged port.");
    console.error(
      "Preferred machine setup: iokoia install portless (service + writable state).",
    );
    process.exit(1);
  }
}

function assertHealthyProcess() {
  util.assertPm2Online(pm2Bin(), appRoot, APP_NAME);
}

async function main() {
  await loadUtil();
  const command = process.argv[2];

  switch (command) {
    case "start":
      ensurePnpmInstall();
      ensureEnvFile();
      ensurePortlessProxy();
      ensureLogsDir();
      util.pm2EnsureStartedFromEcosystem(pm2Bin(), appRoot, APP_NAME, ecosystemFile, {
        preferredArgs: isRegistered()
          ? ["restart", APP_NAME, "--update-env"]
          : ["start", ecosystemFile, "--update-env"],
      });
      runPm2(["describe", APP_NAME]);
      assertHealthyProcess();
      console.log(`\nPublic URL: ${PUBLIC_URL}`);
      break;

    case "stop":
      // Always attempt stop — do not gate on isRegistered() (jlist skew).
      util.pm2StopByName(pm2Bin(), appRoot, APP_NAME);
      break;

    case "restart":
      ensurePnpmInstall();
      ensureEnvFile();
      ensurePortlessProxy();
      ensureLogsDir();
      util.pm2EnsureStartedFromEcosystem(pm2Bin(), appRoot, APP_NAME, ecosystemFile, {
        preferredArgs: isRegistered()
          ? ["restart", APP_NAME, "--update-env"]
          : ["start", ecosystemFile, "--update-env"],
      });
      runPm2(["describe", APP_NAME]);
      assertHealthyProcess();
      console.log(`\nPublic URL: ${PUBLIC_URL}`);
      break;

    case "logs":
      // Never gate on jlist alone (skew → false "not running" → exit 1 → concurrently -k
      // kills the whole monorepo follow). Prefer describe-aware probe; always try `pm2 logs`.
      if (!util.isPm2NameOnline(pm2Bin(), appRoot, APP_NAME) && !isRegistered()) {
        console.warn(
          `${APP_NAME}: jlist/describe could not confirm online (PM2 skew?). Still attaching logs — Ctrl+C to leave.`,
        );
      }
      {
        const logs = spawnSync(
          process.execPath,
          [pm2Bin(), "logs", APP_NAME, "--lines", "100"],
          { cwd: appRoot, stdio: "inherit", env: process.env },
        );
        if (logs.error) {
          console.error(logs.error.message);
          process.exit(1);
        }
        // Soft exit: missing process must not kill monorepo `concurrently` follow.
        if (logs.status !== 0) {
          console.warn(
            `${APP_NAME}: pm2 logs exited ${logs.status ?? 1}. Other apps' log follows should keep running.`,
          );
          process.exit(0);
        }
      }
      break;

    case "status":
      if (!isRegistered()) {
        console.log(`${APP_NAME} is not registered in PM2 (jlist empty or name missing).`);
        console.log(
          "If the process is actually online, fix PM2 client/daemon skew (root pm2 + pm2 update) and retry.",
        );
        process.exit(0);
      }
      runPm2(["describe", APP_NAME]);
      if (isRunning()) {
        console.log(`\n${APP_NAME} is online.`);
        console.log(`Public URL: ${PUBLIC_URL}`);
      } else {
        console.log(
          `\n${APP_NAME} is registered but not healthy (check status).`,
        );
        process.exitCode = 1;
      }
      break;

    default:
      console.error(
        "Usage: node scripts/pm2-dev.mjs <start|stop|restart|logs|status>",
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
