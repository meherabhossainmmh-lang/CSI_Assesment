import type { Queryable, NormalizedEvent, EventLifecycleStatus } from '../../shared/types';

export interface StoredEventRow {
  id: number;
  source_id: string;
  event_id: string;
  event_type: 'COUNT' | 'VOID';
  quantity: number | null;
  target_event_id: string | null;
  event_time: Date;
  status: EventLifecycleStatus;
  normalized_hash: string;
  normalized_payload: NormalizedEvent;
  received_at: Date;
  acknowledged_at: Date | null;
  reversed_by_event_id: string | null;
  reversed_quantity: number | null;
  rejection_reason: string | null;
}

/** Upsert the production source row (auto-registered on first sight). */
export async function ensureSource(db: Queryable, sourceId: string): Promise<void> {
  await db.query(
    `INSERT INTO production_sources (source_id, display_name)
     VALUES ($1, $1)
     ON CONFLICT (source_id) DO NOTHING`,
    [sourceId],
  );
}

/**
 * Claim a logical event identity atomically. Returns the new row when this
 * caller won the insert, or null when a concurrent/earlier submission already
 * owns (source_id, event_id) - in which case the caller must classify the
 * incoming item as DUPLICATE or CONFLICT against the existing row.
 */
export async function insertEventIfAbsent(
  db: Queryable,
  ev: NormalizedEvent,
  hash: string,
  initialStatus: EventLifecycleStatus,
): Promise<StoredEventRow | null> {
  const res = await db.query(
    `INSERT INTO production_events
       (source_id, event_id, event_type, quantity, target_event_id, event_time,
        status, normalized_hash, normalized_payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT ON CONSTRAINT uq_events_source_event DO NOTHING
     RETURNING *`,
    [
      ev.source_id,
      ev.event_id,
      ev.type,
      ev.quantity,
      ev.target_event_id,
      ev.event_time,
      initialStatus,
      hash,
      JSON.stringify(ev),
    ],
  );
  return res.rows[0] ?? null;
}

/** Lock and fetch the stored logical event for (source_id, event_id). */
export async function lockEvent(
  db: Queryable,
  sourceId: string,
  eventId: string,
): Promise<StoredEventRow | null> {
  const res = await db.query(
    `SELECT * FROM production_events
     WHERE source_id = $1 AND event_id = $2
     FOR UPDATE`,
    [sourceId, eventId],
  );
  return res.rows[0] ?? null;
}

/** Fetch a COUNT target inside the same source, locked for update. */
export async function lockCountTarget(
  db: Queryable,
  sourceId: string,
  targetEventId: string,
): Promise<StoredEventRow | null> {
  const res = await db.query(
    `SELECT * FROM production_events
     WHERE source_id = $1 AND event_id = $2 AND event_type = 'COUNT'
     FOR UPDATE`,
    [sourceId, targetEventId],
  );
  return res.rows[0] ?? null;
}

export async function updateEvent(
  db: Queryable,
  id: number,
  patch: Partial<StoredEventRow>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = $${i++}`);
    values.push(value);
  }
  values.push(id);
  await db.query(
    `UPDATE production_events SET ${fields.join(', ')} WHERE id = $${i}`,
    values,
  );
}

/** Pending VOIDs (oldest first) that are waiting for a given COUNT. */
export async function findPendingVoidsFor(
  db: Queryable,
  sourceId: string,
  targetEventId: string,
): Promise<StoredEventRow[]> {
  const res = await db.query(
    `SELECT * FROM production_events
     WHERE source_id = $1 AND event_type = 'VOID' AND target_event_id = $2
       AND status = 'PENDING_REFERENCE'
     ORDER BY received_at ASC, id ASC
     FOR UPDATE`,
    [sourceId, targetEventId],
  );
  return res.rows;
}

export interface AttemptInput {
  channel: 'REST' | 'MQTT';
  challengeId?: string | null;
  raw: unknown;
  sourceId?: string | null;
  eventId?: string | null;
  classification: string;
  error?: string | null;
  normalized?: NormalizedEvent | null;
  hash?: string | null;
}

/** Record exactly one durable submission attempt (audit trail). */
export async function recordAttempt(db: Queryable, input: AttemptInput): Promise<void> {
  await db.query(
    `INSERT INTO submission_attempts
       (channel, challenge_id, raw_payload, source_id, event_id, classification,
        error, normalized_payload, normalized_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.channel,
      input.challengeId ?? null,
      JSON.stringify(input.raw),
      input.sourceId ?? null,
      input.eventId ?? null,
      input.classification,
      input.error ?? null,
      input.normalized ? JSON.stringify(input.normalized) : null,
      input.hash ?? null,
    ],
  );
}
