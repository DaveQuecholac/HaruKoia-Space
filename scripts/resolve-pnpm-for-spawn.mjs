/**
 * Resolves how to spawn pnpm from Node (esp. Windows).
 * Copy to: <repo>/scripts/resolve-pnpm-for-spawn.mjs
 *
 * On Windows, `pnpm` / `pnpm.cmd` are not always valid for spawnSync(shell:false).
 * Prefer standalone `pnpm.exe` under %LOCALAPPDATA%\pnpm\.tools\pnpm-exe\<ver>\.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareSemverDirDesc(a, b) {
  const pa = a.split(".").map((x) => parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return 0;
}

/**
 * @returns {{ command: string, shell: boolean }}
 */
export function resolvePnpmForSpawn() {
  if (process.platform !== "win32") {
    return { command: "pnpm", shell: false };
  }
  const local = process.env.LOCALAPPDATA;
  const exeBase = local ? path.join(local, "pnpm", ".tools", "pnpm-exe") : null;
  if (!exeBase || !fs.existsSync(exeBase)) {
    return { command: "pnpm", shell: true };
  }
  const dirs = fs
    .readdirSync(exeBase, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(exeBase, name, "pnpm.exe")));
  if (dirs.length === 0) {
    return { command: "pnpm", shell: true };
  }
  dirs.sort(compareSemverDirDesc);
  return { command: path.join(exeBase, dirs[0], "pnpm.exe"), shell: false };
}
