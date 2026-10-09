import type { Pool, PoolClient } from 'pg';
import { withTransaction } from '../../config/database';
import { validateEvent } from './events.validation';
import {
  ensureSource,
  insertEventIfAbsent,
  lockEvent,
  lockCountTarget,
  updateEvent,
  findPendingVoidsFor,
  recordAttempt,
  type StoredEventRow,
} from './events.repository';
import { emitDomainEvent, type DomainEventType } from '../../shared/domainEvents';
import type { NormalizedEvent, ProcessItemResult } from '../../shared/types';

export type Channel = 'REST' | 'MQTT';

type Fact = { type: DomainEventType; payload: Record<string, unknown> };

function rawEventId(raw: unknown): string | null {
  if (raw && typeof raw === 'object' && typeof (raw as any).event_id === 'string') {
    return (raw as any).event_id;
  }
  return null;
}

/**
 * Process a batch of raw items inside ONE database transaction, preserving
 * order. A per-item business REJECTED outcome is recorded but does not abort
 * the transaction; only a hard database failure rolls the whole batch back.
 * See TECHNICAL_EXPLANATION.md (batch atomicity assumption).
 */
export async function processEvents(
  pool: Pool,
  items: unknown[],
  channel: Channel,
  challengeId: string | null = null,
): Promise<ProcessItemResult[]> {
  const facts: Fact[] = [];
  const results = await withTransaction(pool, async (client) => {
    const out: ProcessItemResult[] = [];
    for (const raw of items) {
      out.push(await processEvent(client, raw, channel, challengeId, facts));
    }
    return out;
  });

  // Notifications fire only after the transaction has committed.
  for (const fact of facts) emitDomainEvent(fact.type, fact.payload);
  return results;
}

/** Single-item pipeline shared by REST and MQTT. */
async function processEvent(
  client: PoolClient,
  raw: unknown,
  channel: Channel,
  challengeId: string | null,
  facts: Fact[],
): Promise<ProcessItemResult> {
  const validation = validateEvent(raw);

  if (!validation.ok) {
    const message = validation.errors.join('; ');
    await recordAttempt(client, {
      channel,
      challengeId,
      raw,
      sourceId: raw && typeof raw === 'object' ? toStr((raw as any).source_id) : null,
      eventId: rawEventId(raw),
      classification: 'REJECTED',
      error: message,
    });
    facts.push({ type: 'EVENT_REJECTED', payload: { event_id: rawEventId(raw), message } });
    return { event_id: rawEventId(raw), status: 'REJECTED', message };
  }

  const { normalized, hash } = validation;
  await ensureSource(client, normalized.source_id);

  const initialStatus = normalized.type === 'COUNT' ? 'ACCEPTED' : 'PENDING_REFERENCE';
  const inserted = await insertEventIfAbsent(client, normalized, hash, initialStatus);

  if (inserted === null) {
    // Identity already owned by an earlier (or concurrent) submission.
    const existing = await lockEvent(client, normalized.source_id, normalized.event_id);
    if (existing && existing.normalized_hash === hash) {
      await recordAttempt(client, {
        channel, challengeId, raw,
        sourceId: normalized.source_id, eventId: normalized.event_id,
        classification: 'DUPLICATE', error: null, normalized, hash,
      });
      facts.push({ type: 'EVENT_DUPLICATE', payload: { event_id: normalized.event_id } });
      return {
        event_id: normalized.event_id,
        status: 'DUPLICATE',
        message: 'Duplicate submission; totals unchanged',
      };
    }
    await recordAttempt(client, {
      channel, challengeId, raw,
      sourceId: normalized.source_id, eventId: normalized.event_id,
      classification: 'CONFLICT',
      error: 'Same event_id with different data; original preserved',
      normalized, hash,
    });
    facts.push({ type: 'EVENT_CONFLICT', payload: { event_id: normalized.event_id } });
    return {
      event_id: normalized.event_id,
      status: 'CONFLICT',
      message: 'Event ID already exists with different data; original preserved',
    };
  }

  // We own a brand-new logical event.
  if (normalized.type === 'COUNT') {
    await resolvePendingVoids(client, inserted, facts);
    await recordAttempt(client, {
      channel, challengeId, raw,
      sourceId: normalized.source_id, eventId: normalized.event_id,
      classification: 'ACCEPTED', error: null, normalized, hash,
    });
    facts.push({ type: 'EVENT_ACCEPTED', payload: { event_id: normalized.event_id } });
    return { event_id: normalized.event_id, status: 'ACCEPTED', message: 'Event processed' };
  }

  // VOID: try to apply now, else remain PENDING_REFERENCE.
  const applied = await tryApplyVoid(client, inserted, facts);
  await recordAttempt(client, {
    channel, challengeId, raw,
    sourceId: normalized.source_id, eventId: normalized.event_id,
    classification: applied.status, error: applied.status === 'REJECTED' ? applied.message : null,
    normalized, hash,
  });
  return { event_id: normalized.event_id, status: applied.status, message: applied.message };
}

/**
 * Attempt to apply a freshly stored VOID against its target COUNT in the same
 * source. Locks the target row to keep competing reversals mutually exclusive.
 */
async function tryApplyVoid(
  client: PoolClient,
  voidRow: StoredEventRow,
  facts: Fact[],
): Promise<{ status: 'ACCEPTED' | 'PENDING_REFERENCE' | 'REJECTED'; message: string }> {
  const target = await lockEvent(client, voidRow.source_id, voidRow.target_event_id as string);

  if (!target) {
    facts.push({ type: 'VOID_PENDING', payload: { event_id: voidRow.event_id, target: voidRow.target_event_id } });
    return {
      status: 'PENDING_REFERENCE',
      message: 'VOID stored; waiting for matching COUNT',
    };
  }

  if (target.event_type !== 'COUNT') {
    await updateEvent(client, voidRow.id, {
      status: 'REJECTED',
      rejection_reason: 'target_event_id does not reference a COUNT event',
    });
    return { status: 'REJECTED', message: 'VOID target is not a COUNT event' };
  }

  if (target.reversed_by_event_id) {
    await updateEvent(client, voidRow.id, {
      status: 'REJECTED',
      rejection_reason: 'target COUNT already reversed by another VOID',
    });
    return { status: 'REJECTED', message: 'Target COUNT has already been reversed' };
  }

  await applyReversal(client, voidRow, target);
  facts.push({ type: 'VOID_RESOLVED', payload: { event_id: voidRow.event_id, target: target.event_id } });
  return { status: 'ACCEPTED', message: 'VOID applied; COUNT reversed' };
}

/** Mark a VOID as applied and stamp the reversal onto the target COUNT. */
async function applyReversal(client: PoolClient, voidRow: StoredEventRow, countRow: StoredEventRow) {
  await updateEvent(client, voidRow.id, {
    status: 'ACCEPTED',
    reversed_quantity: countRow.quantity,
    acknowledged_at: new Date(), // completed VOIDs are auto-acknowledged
  });
  await updateEvent(client, countRow.id, {
    reversed_by_event_id: voidRow.event_id,
  });
}

/**
 * When a COUNT lands, resolve any earlier PENDING_REFERENCE VOIDs aimed at it.
 * The first stored valid VOID wins; competing VOIDs are rejected with reasons.
 */
async function resolvePendingVoids(client: PoolClient, countRow: StoredEventRow, facts: Fact[]) {
  const pending = await findPendingVoidsFor(client, countRow.source_id, countRow.event_id);
  if (pending.length === 0) return;

  const [winner, ...losers] = pending;
  await applyReversal(client, winner, countRow);
  facts.push({ type: 'VOID_RESOLVED', payload: { event_id: winner.event_id, target: countRow.event_id } });

  for (const loser of losers) {
    await updateEvent(client, loser.id, {
      status: 'REJECTED',
      rejection_reason: 'Competing VOID lost to the first stored valid VOID',
    });
    facts.push({ type: 'EVENT_REJECTED', payload: { event_id: loser.event_id } });
  }
}

function toStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}
