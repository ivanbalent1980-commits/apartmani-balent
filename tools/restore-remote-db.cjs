const fs = require('fs');
const path = require('path');
const { Client } = require('./.db-migrate-deps/node_modules/pg');

const backupDir = path.resolve(__dirname, '..', 'backups', 'supabase-migration-2026-07-27');

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function connect() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  await client.query('set role postgres');
  return client;
}

async function restoreDatabase() {
  const schemaSql = fs.readFileSync(path.join(backupDir, 'public-schema.sql'), 'utf8');
  const data = JSON.parse(fs.readFileSync(path.join(backupDir, 'public-data.json'), 'utf8'));
  const client = await connect();

  await client.query(schemaSql);
  await client.query('begin');
  await client.query("set local session_replication_role = 'replica'");

  for (const [tableName, rows] of Object.entries(data)) {
    for (const row of rows) {
      const columns = Object.keys(row);
      if (!columns.length) continue;
      const values = columns.map((column) => row[column]);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      const sql =
        `insert into public.${quoteIdent(tableName)}` +
        ` (${columns.map(quoteIdent).join(', ')}) values (${placeholders})`;
      await client.query(sql, values);
    }
  }

  await client.query('commit');
  await client.end();

  const totalRows = Object.values(data).reduce((sum, rows) => sum + rows.length, 0);
  console.log(`Restored ${Object.keys(data).length} tables and ${totalRows} rows.`);
}

restoreDatabase().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
