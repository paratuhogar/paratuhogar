const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { startPointsPostgres } = require('./points-postgres.cjs');

exports.startCustomerBindingsPostgres = async function startCustomerBindingsPostgres({ migrate = true } = {}) {
  const db = await startPointsPostgres();
  try {
    const root = path.resolve(__dirname, '../..');
    await db.query(await readFile(path.join(root, 'tests/fixtures/customer-bindings.sql'), 'utf8'));
    if (migrate) await db.query(await readFile(path.join(root,
      'supabase/migrations/20261122222020_protect_customer_assignment.sql'), 'utf8'));
    return db;
  } catch (error) { await db.stop(); throw error; }
};
