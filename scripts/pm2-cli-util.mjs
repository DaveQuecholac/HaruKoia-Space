/**
 * Shared PM2 client helpers for kit scripts (pm2-dev / pm2-tunnel-dev).
 * Copy to: <repo>/scripts/pm2-cli-util.mjs (root) and/or keep next to app helpers.
 *
 * Addresses monorepo feedback:
 * - Client/daemon skew: jlist may exit ≠ 0 / return empty while `describe` shows online.
 * - Prefer one PM2 binary (walk up to repo root node_modules/pm2).
 * - Windows: status online with pid 0/missing (wmic/pidusage) must not fail health checks.
 * - Health must NOT false-negative after a successful start/restart + describe.
 * - Health must NOT false-positive: registered+stopped is offline (do not treat
 *   a successful `describe` alone as online).
 * - When `restartProcessId` fails (`Process N not found`), recover via delete+start.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** @type {boolean} */
let skewWarned = false;

/**
 * Prefer the nearest `node_modules/pm2/bin/pm2`, walking up from `startDir`
 * so monorepo packages share the **root** client when possible (avoid skew).
 * @param {string} startDir
 * @returns {string}
 */
export function resolvePm2Bin(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = resolve(dir, "node_modules/pm2/bin/pm2");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return resolve(startDir, "node_modules/pm2/bin/pm2");
}

/**
 * Extract a JSON array from `pm2 jlist` stdout/stderr (ignores banners / warnings).
 * @param {string} text
 * @returns {unknown[] | null}
 */
export function extractPm2Jlist(text) {
  if (!text || typeof text !== "string") {
    return null;
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function pm2StdoutLooksOutOfDate(text) {
  return /in-memory pm2 is out-of-date/i.test(text || "");
}

/**
 * @param {string} combined
 */
function warnSkewOnce(combined) {
  if (!pm2StdoutLooksOutOfDate(combined) || skewWarned) {
    return;
  }
  skewWarned = true;
  console.warn(
    "[pm2-cli-util] PM2 client/daemon skew (In-memory PM2 is out-of-date). " +
      "Pin one pm2 at the monorepo root, then run once: pnpm exec pm2 update",
  );
}

/**
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @returns {unknown[]}
 */
export function listPm2Processes(pm2BinPath, cwd) {
  const result = spawnSync(process.execPath, [pm2BinPath, "jlist"], {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const combined = `${result.stdout || ""}${result.stderr || ""}`;
  warnSkewOnce(combined);
  const list =
    extractPm2Jlist(result.stdout || "") || extractPm2Jlist(combined);
  if (list) {
    return list;
  }
  // Empty is NOT proof the process is down (skew). Prefer describe-based probes.
  return [];
}

/**
 * Healthy enough for start/status: online. On Windows, pid may be 0/undefined
 * when pidusage cannot spawn wmic — do not require pid > 0.
 * @param {any} entry
 * @returns {boolean}
 */
export function isPm2EntryRunning(entry) {
  if (!entry) {
    return false;
  }
  return entry.pm2_env?.status === "online";
}

/**
 * Parse `pm2 describe <name>` text for an explicit stopped/errored status.
 * @param {string} text
 * @returns {boolean}
 */
export function describeTextLooksStopped(text) {
  if (!text) {
    return false;
  }
  return /status\s*[│|:][^\n]*\b(stopped|errored|stopping)\b/i.test(text);
}

/**
 * Parse `pm2 describe <name>` text for status=online (table or key lines).
 * Explicit stopped/errored wins over loose "online" matches elsewhere in the dump.
 * @param {string} text
 * @returns {boolean}
 */
export function describeTextLooksOnline(text) {
  if (!text) {
    return false;
  }
  if (describeTextLooksStopped(text)) {
    return false;
  }
  // Table cell: │ status │ online │  or "status : online"
  return /status\s*[│|:][^\n]*\bonline\b/i.test(text);
}

/**
 * Probe whether a named app is online. Uses jlist when the app is listed
 * (trust status, including stopped). Falls back to `pm2 describe` only when
 * jlist omits the app (client/daemon skew).
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string} name
 * @returns {boolean}
 */
export function isPm2NameOnline(pm2BinPath, cwd, name) {
  const list = listPm2Processes(pm2BinPath, cwd);
  const entry = list.find((e) => e && e.name === name);
  if (entry) {
    // App is registered: jlist status is source of truth (do not treat
    // "describe succeeded" as online — stopped apps still describe cleanly).
    return isPm2EntryRunning(entry);
  }

  const desc = spawnSync(process.execPath, [pm2BinPath, "describe", name], {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
  });
  const text = `${desc.stdout || ""}${desc.stderr || ""}`;
  warnSkewOnce(text);
  return desc.status === 0 && describeTextLooksOnline(text);
}

/**
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string[]} args
 * @returns {{ status: number | null, out: string, error?: Error }}
 */
function runPm2Capture(pm2BinPath, cwd, args) {
  const result = spawnSync(process.execPath, [pm2BinPath, ...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 8 * 1024 * 1024,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  warnSkewOnce(out);
  return {
    status: result.status,
    out,
    error: result.error || undefined,
  };
}

/**
 * @param {{ status: number | null, out: string, error?: Error }} captured
 */
function writePm2Capture(captured) {
  if (captured.out) {
    process.stdout.write(captured.out);
  }
  if (captured.error) {
    console.error(captured.error.message);
  }
}

/**
 * True when PM2 failed to recycle via restartProcessId (known God-daemon trap).
 * @param {string} text
 * @returns {boolean}
 */
export function pm2RestartProcessNotFound(text) {
  return /Process\s+\d+\s+not found/i.test(text || "");
}

/**
 * Delete a named app from PM2. Missing app is OK.
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string} name
 * @returns {void}
 */
export function pm2DeleteByName(pm2BinPath, cwd, name) {
  const captured = runPm2Capture(pm2BinPath, cwd, ["delete", name]);
  writePm2Capture(captured);
  if (captured.status === 0) {
    return;
  }
  if (
    /doesn'?t exist|not found|process or namespace/i.test(captured.out) ||
    (/\[pm2\]\[error\]/i.test(captured.out) && /not found|doesn't exist/i.test(captured.out))
  ) {
    return;
  }
  if (captured.error) {
    process.exit(1);
  }
  process.exit(captured.status ?? 1);
}

/**
 * Start (or recycle) an app from an ecosystem file. If `startOrRestart` /
 * `restart` leaves the app offline — or PM2 reports `Process N not found` —
 * recover with `delete` + `start <ecosystem>`.
 *
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string} name
 * @param {string} ecosystemFile
 * @param {{ preferredArgs?: string[], recoverArgs?: string[], updateEnv?: boolean }} [opts]
 * @returns {void}
 */
export function pm2EnsureStartedFromEcosystem(
  pm2BinPath,
  cwd,
  name,
  ecosystemFile,
  opts = {},
) {
  const updateEnv = opts.updateEnv !== false;
  const envFlag = updateEnv ? ["--update-env"] : [];
  const preferredArgs =
    opts.preferredArgs && opts.preferredArgs.length > 0
      ? opts.preferredArgs
      : ["startOrRestart", ecosystemFile, ...envFlag];
  const recoverArgs =
    opts.recoverArgs && opts.recoverArgs.length > 0
      ? opts.recoverArgs
      : ["start", ecosystemFile, ...envFlag];

  const first = runPm2Capture(pm2BinPath, cwd, preferredArgs);
  writePm2Capture(first);

  const needsRecover =
    pm2RestartProcessNotFound(first.out) || !isPm2NameOnline(pm2BinPath, cwd, name);

  if (!needsRecover) {
    return;
  }

  console.warn(
    `[pm2-cli-util] ${name} not healthy after ${preferredArgs[0]}` +
      (pm2RestartProcessNotFound(first.out) ? " (Process not found)" : "") +
      "; recovering via delete + start…",
  );
  pm2DeleteByName(pm2BinPath, cwd, name);

  const second = runPm2Capture(pm2BinPath, cwd, recoverArgs);
  writePm2Capture(second);
  if (second.error) {
    process.exit(1);
  }
  if (second.status !== 0 && !isPm2NameOnline(pm2BinPath, cwd, name)) {
    process.exit(second.status ?? 1);
  }
}

/**
 * After start/restart: retry probe; never treat empty jlist alone as failure.
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string} name
 * @returns {void}
 */
export function assertPm2Online(pm2BinPath, cwd, name) {
  for (let attempt = 0; attempt < 8; attempt++) {
    if (isPm2NameOnline(pm2BinPath, cwd, name)) {
      return;
    }
    spawnSync(
      process.platform === "win32" ? "powershell.exe" : "sleep",
      process.platform === "win32"
        ? ["-NoProfile", "-Command", "Start-Sleep -Milliseconds 250"]
        : ["0.25"],
      { stdio: "ignore" },
    );
  }

  if (isPm2NameOnline(pm2BinPath, cwd, name)) {
    return;
  }

  console.error(
    `${name} is not healthy after start (could not confirm online via jlist/describe).`,
  );
  console.error(
    "If PM2 already printed status online above, align versions: pin root pm2 + `pnpm exec pm2 update`, then retry. Check logs/pm2/*.log.",
  );
  process.exit(1);
}

/**
 * Always attempt `pm2 stop <name>`. Do not gate on jlist registration
 * (skew can make list empty while the process is online).
 * @param {string} pm2BinPath
 * @param {string} cwd
 * @param {string} name
 * @returns {void}
 */
export function pm2StopByName(pm2BinPath, cwd, name) {
  const result = spawnSync(process.execPath, [pm2BinPath, "stop", name], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  warnSkewOnce(out);
  if (result.status === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    return;
  }
  if (
    /doesn'?t exist|not found|process or namespace/i.test(out) ||
    (/\[pm2\]\[error\]/i.test(out) && /not found|doesn't exist/i.test(out))
  ) {
    console.log(`${name} is not registered in PM2 (or already stopped).`);
    return;
  }
  if (out.trim()) {
    process.stderr.write(out);
  } else if (result.error) {
    console.error(result.error.message);
  }
  process.exit(result.status ?? 1);
}
