import type { Pool, PoolClient, QueryResult } from 'pg';

/** Minimal query interface satisfied by both pg.Pool and pg.PoolClient so
 * services can run against the pool or inside a transaction client. */
export interface Queryable {
  query(text: string, params?: unknown[]): Promise<QueryResult<any>>;
}

export type EventType = 'COUNT' | 'VOID';

/** Per-item outcomes returned by POST /api/events and by MQTT challenges. */
export type ItemStatus =
  | 'ACCEPTED'
  | 'DUPLICATE'
  | 'CONFLICT'
  | 'PENDING_REFERENCE'
  | 'REJECTED';

/** Logical lifecycle of a stored production event. */
export type EventLifecycleStatus = 'ACCEPTED' | 'PENDING_REFERENCE' | 'REJECTED';

/** A fully validated + normalized production event, ready for persistence. */
export interface NormalizedEvent {
  source_id: string;
  event_id: string;
  type: EventType;
  quantity: number | null;
  target_event_id: string | null;
  event_time: string; // ISO 8601 with timezone (normalized)
}

export interface ProcessItemResult {
  event_id: string | null;
  status: ItemStatus;
  message: string;
}

export interface Summary {
  net_total: number;
  processed_events: number;
  pending_ack: number;
  unresolved: number;
  duplicates: number;
  conflicts: number;
  /** Change request FSE-01/02: stored REJECTED submission attempts. */
  rejected_submissions: number;
}

export type AckStatus = 'ACKED' | 'ALREADY_ACKED' | 'NOT_READY' | 'NOT_FOUND';

export interface AckResult {
  event_id: string;
  status: AckStatus;
  message: string;
}

export type { Pool, PoolClient };
