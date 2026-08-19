const { Client } = require('./.db-migrate-deps/node_modules/pg');

async function main() {
  const client = new Client({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  console.error('Connecting to remote database...');
  await client.connect();
  console.error('Connected.');
  await client.query('set role postgres');

  const tables = await client.query(`
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);

  const rowCounts = [];
  for (const { table_name: tableName } of tables.rows) {
    const quoted = `"${tableName.replaceAll('"', '""')}"`;
    const result = await client.query(`select count(*)::int as count from public.${quoted}`);
    rowCounts.push({ table: tableName, rows: result.rows[0].count });
  }

  const objectCounts = await client.query(`
    select
      (select count(*)::int from pg_views where schemaname = 'public') as views,
      (
        select count(*)::int
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      ) as functions,
      (select count(*)::int from pg_policies where schemaname = 'public') as policies,
      (
        select count(*)::int
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
      ) as triggers
  `);

  console.log(JSON.stringify({
    tables: rowCounts,
    databaseObjects: objectCounts.rows[0],
  }, null, 2));

  await client.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
