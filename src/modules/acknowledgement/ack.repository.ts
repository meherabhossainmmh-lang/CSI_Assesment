import type { Queryable } from '../../shared/types';
import type { StoredEventRow } from '../events/events.repository';

/**
 * Resolve a logical event by bare event_id. The composite identity is
 * (source_id, event_id); the ack API is handed bare ids, so we return all
 * matching logical events ordered by first-stored. Callers take the earliest.
 */
export async function lockEventsByEventId(
  db: Queryable,
  eventId: string,
): Promise<StoredEventRow[]> {
  const res = await db.query(
    `SELECT * FROM production_events
     WHERE event_id = $1
     ORDER BY id ASC
     FOR UPDATE`,
    [eventId],
  );
  return res.rows;
}

export async function setAcknowledged(db: Queryable, id: number, at: Date): Promise<void> {
  await db.query(
    `UPDATE production_events SET acknowledged_at = $1 WHERE id = $2`,
    [at, id],
  );
}
