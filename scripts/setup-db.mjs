import { readFile } from 'node:fs/promises';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = await readFile(new URL('../db/migrations/0001_init.sql', import.meta.url), 'utf8');
const client = new Client({
  connectionString,
  ssl: /sslmode=require/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  await client.query(sql);
  console.log('Aiven PostgreSQL schema, indexes, triggers, templates, and RLS policies are ready.');
} catch (error) {
  console.error('Database setup failed. Check DATABASE_URL, network access, and Aiven credentials.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
