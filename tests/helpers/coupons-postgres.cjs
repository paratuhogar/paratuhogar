const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { startPointsPostgres } = require('./points-postgres.cjs');

// Native, disposable PostgreSQL. Existing points/numbering functions are real,
// not test doubles; only the production schema's prerequisites are synthetic.
exports.startCouponsPostgres = async function startCouponsPostgres() {
  const db = await startPointsPostgres();
  try {
    for (const file of ['tests/fixtures/coupons.sql',
      'supabase/migrations/20261122222020_protect_customer_assignment.sql',
      'supabase/migrations/20261122222039_direct_customer_coupons.sql']) {
      await db.query(await readFile(path.resolve(__dirname, '../..', file), 'utf8'));
    }
    return db;
  } catch (error) { await db.stop(); throw error; }
};
