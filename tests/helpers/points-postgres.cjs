const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { Pool } = require('pg');

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

exports.startPointsPostgres = async function startPointsPostgres({ referralOnly = true } = {}) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const directory = await mkdtemp(path.join(tmpdir(), 'pth-points-postgres-'));
  const port = await freePort();
  const cluster = new EmbeddedPostgres({
    databaseDir: path.join(directory, 'cluster'), port, user: 'postgres',
    password: 'disposable-test-only', persistent: false, autoRehydrateSymlinks: true,
    postgresFlags: ['-h', '127.0.0.1', '-c', 'max_connections=30'],
    onLog() {}, onError() {},
  });
  let pool;
  try {
    await cluster.initialise();
    await cluster.start();
    pool = new Pool({ host: '127.0.0.1', port, user: 'postgres',
      password: 'disposable-test-only', database: 'postgres', max: 18 });
    const root = path.resolve(__dirname, '../..');
    for (const file of ['tests/fixtures/points-wallet.sql',
      'supabase/proposals/atomic-order-numbering.sql', 'supabase/proposals/subgestor-review.sql',
      'supabase/migrations/20261122115426_points_wallet.sql',
      ...(referralOnly ? ['supabase/migrations/20261122175858_points_referral_sales_only.sql'] : [])]) {
      await pool.query(await readFile(path.join(root, file), 'utf8'));
    }
    return {
      query: (...args) => pool.query(...args),
      connect: () => pool.connect(),
      async service(sql, params = []) {
        const client = await pool.connect();
        try {
          await client.query('set role service_role');
          return await client.query(sql, params);
        } finally {
          await client.query('reset role');
          client.release();
        }
      },
      async stop() { await pool.end(); await cluster.stop(); await rm(directory, { recursive: true, force: true }); },
    };
  } catch (error) {
    if (pool) await pool.end();
    await cluster.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
};
