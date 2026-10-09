import { Pool, PoolClient } from 'pg';
import { env } from './environment';
import type { Queryable } from '../shared/types';

/**
 * Create a bounded connection pool. A single pool per process is shared by the
 * REST handlers, the MQTT worker and the state queries so connection usage
 * stays predictable.
 */
export function createPool(connectionString: string): Pool {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on('error', (err) => {
    // Background client errors (e.g. server restart) must not crash the node
    // process; log them and let the pool recycle the client.
    console.error('[db] idle client error:', err.message);
  });

  return pool;
}

/** The application pool, bound to DATABASE_URL. */
export const pool: Pool = createPool(env.databaseUrl);

/** Quick liveness probe used by /api/health and startup checks. */
export async function checkConnection(target: Queryable = pool): Promise<boolean> {
  try {
    await target.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Run `fn` inside a single SQL transaction. Commits on success, rolls back on
 * any error. This is the backbone of batch atomicity and of the row-locked
 * COUNT/VOID/ack updates.
 */
export async function withTransaction<T>(
  target: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await target.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection may already be gone; nothing to do */
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
