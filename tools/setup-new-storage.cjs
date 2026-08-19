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

  await client.connect();
  await client.query('set role postgres');
  await client.query(`
    drop policy if exists "balent_documents_select" on storage.objects;
    drop policy if exists "balent_documents_insert" on storage.objects;
    drop policy if exists "balent_documents_update" on storage.objects;
    drop policy if exists "balent_documents_delete" on storage.objects;

    create policy "balent_documents_select"
      on storage.objects for select to authenticated
      using (bucket_id = 'dokumenti');

    create policy "balent_documents_insert"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'dokumenti');

    create policy "balent_documents_update"
      on storage.objects for update to authenticated
      using (bucket_id = 'dokumenti')
      with check (bucket_id = 'dokumenti');

    create policy "balent_documents_delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'dokumenti');
  `);
  await client.end();
  console.log('Configured authenticated-only policies for the dokumenti bucket.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
