import { pool } from '../src/config/database';
import { runMigrations } from '../src/config/migrate';
import { processEvents } from '../src/modules/events/events.service';
import type { ProcessItemResult } from '../src/shared/types';

let migrated = false;

/** Idempotently apply migrations to the test database once per worker. */
export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  await runMigrations(pool);
  migrated = true;
}

/** Wipe all data between tests so each case starts from a clean slate. */
export async function resetDb(): Promise<void> {
  await pool.query(
    `TRUNCATE TABLE submission_attempts, mqtt_challenges, production_events, production_sources
     RESTART IDENTITY CASCADE`,
  );
}

export async function submit(...items: unknown[]): Promise<ProcessItemResult[]> {
  return processEvents(pool, items, 'REST');
}

export function countEvent(sourceId: string, eventId: string, type: 'COUNT' | 'VOID', quantity?: number) {
  return {
    source_id: sourceId,
    event_id: eventId,
    type,
    quantity: type === 'COUNT' ? (quantity ?? 1) : undefined,
    target_event_id: undefined,
    event_time: new Date().toISOString(),
  };
}

export function voidEvent(sourceId: string, eventId: string, targetEventId: string) {
  return {
    source_id: sourceId,
    event_id: eventId,
    type: 'VOID',
    target_event_id: targetEventId,
    event_time: new Date().toISOString(),
  };
}

export { pool };
