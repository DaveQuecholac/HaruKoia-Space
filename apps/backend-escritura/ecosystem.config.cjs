/**
 * PM2 — backend de escritura (localhost, sin portless).
 * Escucha BACKEND_ESCRITURA_PORT (por defecto 18091).
 */
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const APP_NAME = "harukoia-backend-escritura-dev";
const appDir = __dirname;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    env[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return env;
}

const fileEnv = {
  ...loadEnvFile(resolve(appDir, ".env")),
  ...loadEnvFile(resolve(appDir, ".env.local")),
};

module.exports = {
  apps: [
    {
      name: APP_NAME,
      cwd: appDir,
      script: process.execPath,
      args: ["--env-file=.env", "src/main.ts"],
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
        ...fileEnv,
      },
    },
  ],
};
