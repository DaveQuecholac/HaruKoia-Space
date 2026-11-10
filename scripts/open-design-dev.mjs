#!/usr/bin/env node
/**
 * Open Design junto con `pnpm dev`. No es una app PM2 del motor:
 * el código vive en ~/tools/open-design y lo levanta su propio tools-dev.
 *
 * El kit de scripts/pm2-*.mjs no se toca. Si la carpeta no existe,
 * este paso avisa y deja seguir a las apps del motor.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = path.join(os.homedir(), "tools", "open-design");
const webPort = 7456;
const daemonPort = 7457;
const heapMb = 6144;
const hostname = "diseno.harukoia.local.iokoia.dev";
const routesPath = path.join(os.homedir(), ".portless", "routes.json");
const command = process.argv[2];

function say(message) {
  console.log(`open-design: ${message}`);
}

function absent() {
  say(`no está en ${repo}. Sigue el arranque de las apps del motor.`);
  process.exit(0);
}

function nodeOptions() {
  const kept = (process.env.NODE_OPTIONS ?? "")
    .split(/\s+/)
    .filter((part) => part && !part.startsWith("--max-old-space-size"));
  kept.push(`--max-old-space-size=${heapMb}`);
  return kept.join(" ");
}

function toolsDev(args) {
  const result = spawnSync("corepack", ["pnpm", "exec", "tools-dev", ...args], {
    cwd: repo,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions(),
      OD_ALLOWED_DEV_ORIGINS: `https://${hostname}`,
    },
    stdio: "inherit",
  });
  if (result.error) {
    say(result.error.message);
    return 1;
  }
  if (result.status !== 0) {
    say(`tools-dev terminó con código ${result.status ?? 1}. Las apps del motor siguen.`);
    return result.status ?? 1;
  }
  return 0;
}

function status() {
  const result = spawnSync("corepack", ["pnpm", "exec", "tools-dev", "status", "--json"], {
    cwd: repo,
    encoding: "utf8",
  });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function webHasHeap(pid) {
  try {
    const env = readFileSync(`/proc/${pid}/environ`);
    return env.includes(`max-old-space-size=${heapMb}`);
  } catch {
    return false;
  }
}

function webReady(snapshot) {
  const web = snapshot?.apps?.web;
  if (!web || web.state !== "running" || !web.pid) return false;
  if (web.url !== `http://127.0.0.1:${webPort}`) return false;
  return webHasHeap(web.pid);
}

function registerRoute(pid) {
  if (!existsSync(path.dirname(routesPath))) return;
  let routes = [];
  try {
    const raw = JSON.parse(readFileSync(routesPath, "utf8"));
    if (Array.isArray(raw)) routes = raw;
  } catch {
    routes = [];
  }
  const next = routes.filter((route) => route?.hostname !== hostname);
  next.push({ hostname, port: webPort, pid });
  writeFileSync(routesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  say(`https://${hostname}/`);
  say(`http://127.0.0.1:${webPort}/`);
}

function unregisterRoute() {
  if (!existsSync(routesPath)) return;
  try {
    const raw = JSON.parse(readFileSync(routesPath, "utf8"));
    if (!Array.isArray(raw)) return;
    const next = raw.filter((route) => route?.hostname !== hostname);
    writeFileSync(routesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  } catch {
    // Si el proxy reescribe el archivo en ese instante, el siguiente start lo vuelve a poner.
  }
}

function start() {
  if (!existsSync(repo)) absent();
  const snapshot = status();
  if (!webReady(snapshot)) {
    toolsDev([
      "start",
      "web",
      "--daemon-port",
      String(daemonPort),
      "--web-port",
      String(webPort),
    ]);
  }
  const ready = status();
  const pid = ready?.apps?.web?.pid;
  if (!pid) {
    say("la web no quedó en marcha. Revisa ~/tools/open-design/.tmp/tools-dev/default/logs/web/latest.log");
    process.exit(0);
  }
  registerRoute(pid);
}

function stop() {
  if (!existsSync(repo)) {
    unregisterRoute();
    process.exit(0);
  }
  toolsDev(["stop"]);
  unregisterRoute();
}

if (!["start", "stop", "restart", "status"].includes(command)) {
  console.error("Uso: node scripts/open-design-dev.mjs <start|stop|restart|status>");
  process.exit(2);
}

if (command === "start") start();
if (command === "stop") stop();
if (command === "restart") {
  stop();
  start();
}
if (command === "status") {
  if (!existsSync(repo)) absent();
  toolsDev(["status"]);
  const snapshot = status();
  const pid = snapshot?.apps?.web?.pid;
  if (pid) registerRoute(pid);
  else say("la web no está en marcha.");
}
