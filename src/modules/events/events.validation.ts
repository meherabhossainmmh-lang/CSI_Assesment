import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { NormalizedEvent } from '../../shared/types';

/** ISO 8601 with an explicit timezone (Z or +/-hh:mm), as the brief requires. */
const ISO_WITH_TZ =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Structural gate only; the business rules (per-type quantity/target) are
 * enforced in superRefine so the failure messages stay meaningful.
 */
const eventShape = z
  .object({
    source_id: z.unknown(),
    event_id: z.unknown(),
    type: z.unknown(),
    quantity: z.unknown().optional(),
    target_event_id: z.unknown().optional(),
    event_time: z.unknown(),
  });

export type ValidationResult =
  | { ok: true; normalized: NormalizedEvent; hash: string }
  | { ok: false; errors: string[] };

function toPositiveInt(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    return n > 0 ? n : null;
  }
  return null;
}

function toOptionalString(value: unknown): string | null | 'invalid' {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return 'invalid';
}

/**
 * validateEvent - the single gate every COUNT/VOID passes through, whether it
 * arrived over REST or MQTT. Returns a normalized event plus a stable content
 * hash used for duplicate/conflict detection.
 */
export function validateEvent(raw: unknown): ValidationResult {
  const errors: string[] = [];

  const parsed = eventShape.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: ['Not a JSON object'] };
  }
  const data = parsed.data;

  // source_id
  const sourceId = toOptionalString(data.source_id);
  if (sourceId === 'invalid' || sourceId === null)
    errors.push('source_id must be a non-empty string');

  // event_id
  const eventId = toOptionalString(data.event_id);
  if (eventId === 'invalid' || eventId === null)
    errors.push('event_id must be a non-empty string');

  // type
  const typeRaw = toOptionalString(data.type);
  const type = typeRaw && typeRaw !== 'invalid' ? typeRaw.toUpperCase() : null;
  if (type !== 'COUNT' && type !== 'VOID') errors.push('type must be COUNT or VOID');

  // event_time
  let eventTime: string | null = null;
  if (typeof data.event_time === 'string' && ISO_WITH_TZ.test(data.event_time.trim())) {
    const d = new Date(data.event_time.trim());
    if (!Number.isNaN(d.getTime())) eventTime = d.toISOString();
  }
  if (eventTime === null)
    errors.push('event_time must be an ISO 8601 timestamp with timezone');

  // quantity + target_event_id, per type
  let quantity: number | null = null;
  let targetEventId: string | null = null;
  if (type === 'COUNT') {
    if (data.quantity === undefined || data.quantity === null) {
      errors.push('COUNT requires a positive integer quantity');
    } else {
      const q = toPositiveInt(data.quantity);
      if (q === null) errors.push('COUNT quantity must be a positive integer');
      else quantity = q;
    }
    const target = toOptionalString(data.target_event_id);
    if (target === 'invalid') errors.push('COUNT target_event_id must be null or omitted');
    targetEventId = null;
  } else if (type === 'VOID') {
    if (data.quantity !== undefined && data.quantity !== null) {
      errors.push('VOID quantity must be null or omitted');
    }
    const target = toOptionalString(data.target_event_id);
    if (target === null || target === 'invalid')
      errors.push('VOID requires target_event_id (the COUNT being reversed)');
    else targetEventId = target;
    quantity = null;
  }

  if (errors.length > 0) return { ok: false, errors };

  const normalized: NormalizedEvent = {
    source_id: sourceId as string,
    event_id: eventId as string,
    type: type as 'COUNT' | 'VOID',
    quantity,
    target_event_id: targetEventId,
    event_time: eventTime as string,
  };

  return { ok: true, normalized, hash: canonicalHash(normalized) };
}

/** Stable content hash over the normalized fields (key order fixed). */
export function canonicalHash(ev: NormalizedEvent): string {
  const canonical = JSON.stringify({
    source_id: ev.source_id,
    event_id: ev.event_id,
    type: ev.type,
    quantity: ev.quantity,
    target_event_id: ev.target_event_id,
    event_time: ev.event_time,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export class UninterpretableBodyError extends Error {
  constructor() {
    super('Body must be a JSON event object or an array of event objects');
    this.name = 'UninterpretableBodyError';
  }
}

/**
 * Interpret the top-level POST /api/events body as either a single event or a
 * batch. Objects and arrays are interpretable (-> HTTP 200 with per-item
 * results); anything else throws UninterpretableBodyError (-> HTTP 400).
 */
export function interpretBatch(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (body !== null && typeof body === 'object') return [body];
  throw new UninterpretableBodyError();
}
