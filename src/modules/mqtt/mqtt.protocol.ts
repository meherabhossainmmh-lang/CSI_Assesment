import { createHash } from 'node:crypto';
import type { ProcessItemResult, Summary } from '../../shared/types';

export const SUPPORTED_PROTOCOL = '1.0';
export const SUPPORTED_COMMAND = 'PROCESS_EVENTS';

export type MqttFailureCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_PROTOCOL'
  | 'CHALLENGE_EXPIRED'
  | 'CANDIDATE_MISMATCH'
  | 'CHALLENGE_CONFLICT'
  | 'INTERNAL_ERROR';

/** Deterministic serialization so "same body" survives key-order changes. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const body = keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`)
    .join(',');
  return `{${body}}`;
}

export function challengeDigest(body: unknown): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

/** "08" and "CAND-08" both denote candidate 08. */
export function normalizeCandidateId(id: unknown): string {
  if (typeof id !== 'string') return '';
  return id.trim().replace(/^CAND-/i, '');
}

export interface ValidChallenge {
  protocol_version: string;
  candidate_id: string;
  challenge_id: string;
  command: string;
  sent_at: string | null;
  expires_at: string;
  events: unknown[];
}

export type ChallengeValidation =
  | { ok: true; challenge: ValidChallenge }
  | { ok: false; code: MqttFailureCode; message: string; challengeId: string | null };

/**
 * Validate the envelope in the order the brief specifies, rejecting
 * expired/mismatched challenges BEFORE any event processing happens.
 */
export function validateChallenge(raw: unknown, ourCandidateId: string): ChallengeValidation {
  const challengeId =
    raw && typeof raw === 'object' && typeof (raw as any).challenge_id === 'string'
      ? ((raw as any).challenge_id as string)
      : null;

  const fail = (code: MqttFailureCode, message: string): ChallengeValidation => ({
    ok: false,
    code,
    message,
    challengeId,
  });

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('VALIDATION_ERROR', 'Challenge payload must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  if (obj.protocol_version !== SUPPORTED_PROTOCOL) {
    return fail('UNSUPPORTED_PROTOCOL', `protocol_version must be "${SUPPORTED_PROTOCOL}"`);
  }
  if (normalizeCandidateId(obj.candidate_id) !== normalizeCandidateId(ourCandidateId)) {
    return fail('CANDIDATE_MISMATCH', 'challenge is addressed to a different candidate');
  }
  if (typeof obj.challenge_id !== 'string' || obj.challenge_id.trim() === '') {
    return fail('VALIDATION_ERROR', 'challenge_id is required');
  }
  if (obj.command !== SUPPORTED_COMMAND) {
    return fail('VALIDATION_ERROR', `command must be "${SUPPORTED_COMMAND}"`);
  }
  if (typeof obj.expires_at !== 'string' || Number.isNaN(Date.parse(obj.expires_at))) {
    return fail('VALIDATION_ERROR', 'expires_at must be an ISO 8601 timestamp');
  }
  if (Date.parse(obj.expires_at) < Date.now()) {
    return fail('CHALLENGE_EXPIRED', 'challenge expired before processing');
  }
  if (!Array.isArray(obj.events)) {
    return fail('VALIDATION_ERROR', 'events must be an array');
  }

  return {
    ok: true,
    challenge: {
      protocol_version: String(obj.protocol_version),
      candidate_id: normalizeCandidateId(ourCandidateId),
      challenge_id: obj.challenge_id as string,
      command: String(obj.command),
      sent_at: typeof obj.sent_at === 'string' ? obj.sent_at : null,
      expires_at: obj.expires_at as string,
      events: obj.events,
    },
  };
}

export function buildCompletedResponse(
  candidateId: string,
  challengeId: string,
  results: ProcessItemResult[],
  state: Summary,
) {
  return {
    protocol_version: SUPPORTED_PROTOCOL,
    candidate_id: candidateId,
    challenge_id: challengeId,
    status: 'COMPLETED',
    processed_at: new Date().toISOString(),
    results: results.map((r) => ({ event_id: r.event_id, status: r.status })),
    state,
  };
}

export function buildFailedResponse(
  candidateId: string,
  challengeId: string | null,
  code: MqttFailureCode,
  message: string,
) {
  return {
    protocol_version: SUPPORTED_PROTOCOL,
    candidate_id: candidateId,
    challenge_id: challengeId,
    status: 'FAILED',
    processed_at: new Date().toISOString(),
    error_code: code,
    message,
    results: [],
  };
}
