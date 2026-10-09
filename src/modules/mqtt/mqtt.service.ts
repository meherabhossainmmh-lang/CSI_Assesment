import type { Pool } from 'pg';
import { processEvents } from '../events/events.service';
import { getSummary } from '../state/state.repository';
import {
  validateChallenge,
  challengeDigest,
  buildCompletedResponse,
  buildFailedResponse,
  type MqttFailureCode,
} from './mqtt.protocol';
import { findChallenge, insertChallenge, updateChallenge } from './mqtt.repository';
import { recordAttempt } from '../events/events.repository';
import { withTransaction } from '../../config/database';
import { emitDomainEvent } from '../../shared/domainEvents';

/**
 * handleMqttChallenge - the MQTT entrypoint. It reuses the exact same event
 * service and state queries as REST (no duplicated business logic) and adds
 * challenge-level replay/conflict handling on top.
 *
 * Returns the response object the client should publish.
 */
export async function handleChallenge(
  pool: Pool,
  raw: unknown,
  candidateId: string,
): Promise<Record<string, unknown>> {
  const validation = validateChallenge(raw, candidateId);

  if (!validation.ok) {
    // Persist the failed challenge when we have an id to key on.
    if (validation.challengeId) {
      await persistFailed(pool, validation.challengeId, candidateId, raw, validation.code, validation.message);
    }
    emitDomainEvent('MQTT_CHALLENGE_FAILED', { code: validation.code });
    return buildFailedResponse(candidateId, validation.challengeId, validation.code, validation.message);
  }

  const { challenge } = validation;
  const digest = challengeDigest(raw);

  const existing = await findChallenge(pool, challenge.challenge_id);
  if (existing) {
    if (existing.request_digest === digest && existing.response_body) {
      // Exact replay: return the original stored response, no reprocessing.
      return existing.response_body;
    }
    // Same id, different body -> challenge-level conflict, do NOT process.
    await recordConflictAttempt(pool, challenge.challenge_id, raw);
    emitDomainEvent('MQTT_CHALLENGE_FAILED', { code: 'CHALLENGE_CONFLICT' });
    return buildFailedResponse(
      candidateId,
      challenge.challenge_id,
      'CHALLENGE_CONFLICT',
      'challenge_id reused with a different body',
    );
  }

  // Claim the id; a concurrent insert winning means treat as replay/conflict.
  const claimed = await insertChallenge(pool, {
    challengeId: challenge.challenge_id,
    candidateId: challenge.candidate_id,
    body: raw,
    digest,
  });
  if (claimed === null) {
    const raced = await findChallenge(pool, challenge.challenge_id);
    if (raced && raced.request_digest === digest && raced.response_body) return raced.response_body;
    return buildFailedResponse(
      candidateId,
      challenge.challenge_id,
      'CHALLENGE_CONFLICT',
      'challenge_id reused with a different body',
    );
  }

  try {
    const results = await processEvents(pool, challenge.events, 'MQTT', challenge.challenge_id);
    const state = await getSummary(pool, null);
    const response = buildCompletedResponse(candidateId, challenge.challenge_id, results, state);

    await updateChallenge(pool, claimed.id, {
      status: 'COMPLETED',
      response_body: response,
      processed_at: new Date(),
    });
    emitDomainEvent('MQTT_CHALLENGE_COMPLETED', { challenge_id: challenge.challenge_id });
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'internal error';
    await updateChallenge(pool, claimed.id, {
      status: 'FAILED',
      error_code: 'INTERNAL_ERROR',
      error_message: message,
      processed_at: new Date(),
    });
    emitDomainEvent('MQTT_CHALLENGE_FAILED', { code: 'INTERNAL_ERROR' });
    return buildFailedResponse(candidateId, challenge.challenge_id, 'INTERNAL_ERROR', message);
  }
}

async function persistFailed(
  pool: Pool,
  challengeId: string,
  candidateId: string,
  raw: unknown,
  code: MqttFailureCode,
  message: string,
): Promise<void> {
  const digest = challengeDigest(raw);
  const claimed = await insertChallenge(pool, { challengeId, candidateId, body: raw, digest });
  if (claimed) {
    await updateChallenge(pool, claimed.id, {
      status: 'FAILED',
      error_code: code,
      error_message: message,
      processed_at: new Date(),
    });
  }
}

async function recordConflictAttempt(pool: Pool, challengeId: string, raw: unknown): Promise<void> {
  await withTransaction(pool, async (client) => {
    await recordAttempt(client, {
      channel: 'MQTT',
      challengeId,
      raw,
      sourceId: null,
      eventId: null,
      classification: 'CONFLICT',
      error: 'MQTT challenge_id reused with a different body',
    });
  });
}
