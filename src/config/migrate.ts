import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, PoolClient } from 'pg';
import { env } from './environment';
import type { Queryable } from '../shared/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

/**
 * Tiny ordered SQL migration runner. Applied migration ids are recorded in
 * schema_migrations so reruns are a no-op (idempotent), which also makes it
 * safe for the test setup to call this on every boot. Runs on a single client
 * so each file's BEGIN/COMMIT is a real transaction.
 */
export async function runMigrations(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  try {
    return await runOnClient(client);
  } finally {
    client.release();
  }
}

async function runOnClient(db: Queryable): Promise<string[]> {
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );

  const appliedRows = await db.query('SELECT id FROM schema_migrations');
  const applied = new Set<string>(appliedRows.rows.map((r) => r.id));

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  const newlyApplied: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Run each migration file atomically so a half-applied migration can never
    // be left behind on error.
    await db.query('BEGIN');
    try {
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file]);
      await db.query('COMMIT');
      newlyApplied.push(file);
    } catch (err) {
      await db.query('ROLLBACK').catch(() => {});
      throw err;
    }
  }
  return newlyApplied;
}

/** CLI entrypoint: `npm run migrate` applies to DATABASE_URL. */
async function main() {
  const pool = new Pool({ connectionString: env.databaseUrl });
  try {
    const applied = await runMigrations(pool);
    if (applied.length === 0) {
      console.log('[migrate] up to date, nothing to apply');
    } else {
      console.log(`[migrate] applied: ${applied.join(', ')}`);
    }
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
}
