/**
 * Worker de PowerSync para el espejo de commits (V6).
 * better-sqlite3 ya está en las dependencias de este paquete.
 */
const Database = require('better-sqlite3');
const { startPowerSyncWorker } = require('@powersync/node/worker.js');

startPowerSyncWorker({
  loadBetterSqlite3: async () => Database,
});
