/**
 * Worker PowerSync del lector V7.
 * better-sqlite3 se toma de apps/host (ya compilado en el monorepo).
 */
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const requireDelHost = createRequire(resolve(__dirname, '../../apps/host/package.json'));
const Database = requireDelHost('better-sqlite3');
const { startPowerSyncWorker } = require('@powersync/node/worker.js');

startPowerSyncWorker({
  loadBetterSqlite3: async () => Database,
});
