/**
 * Worker de PowerSync. better-sqlite3 se toma del monorepo (apps/host),
 * porque en esta máquina no hay toolchain para compilar el nativo de la PdC.
 */
const { createRequire } = require('node:module');
const { resolve } = require('node:path');
const requireDelHost = createRequire(
  resolve(__dirname, '../../../apps/host/package.json'),
);
const Database = requireDelHost('better-sqlite3');
const { startPowerSyncWorker } = require('@powersync/node/worker.js');

startPowerSyncWorker({
  loadBetterSqlite3: async () => Database,
});
