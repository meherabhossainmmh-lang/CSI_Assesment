import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureMigrated, resetDb, pool, countEvent } from '../helpers';
import { handleChallenge } from '../../src/modules/mqtt/mqtt.service';
import { getSummary } from '../../src/modules/state/state.repository';

const CAND = '08';
const FIXED_TIME = '2026-10-09T10:30:00Z';

beforeAll(ensureMigrated);
beforeEach(resetDb);

// Fixed event_time so a "replay" is byte-identical (same digest).
function mqttEvent(eventId = 'EV-M1', quantity = 5) {
  return {
    source_id: 'LINE-01',
    event_id: eventId,
    type: 'COUNT',
    quantity,
    target_event_id: null,
    event_time: FIXED_TIME,
  };
}

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    protocol_version: '1.0',
    candidate_id: CAND,
    challenge_id: 'CH-test-1',
    command: 'PROCESS_EVENTS',
    sent_at: FIXED_TIME,
    expires_at: '2030-01-01T00:00:00Z', // fixed + future so replays are identical
    events: [mqttEvent()],
    ...overrides,
  };
}

describe('MQTT challenge processing (shared service)', () => {
  it('valid challenge completes with ordered results and six-field state', async () => {
    const res: any = await handleChallenge(pool, challenge(), CAND);
    expect(res.status).toBe('COMPLETED');
    expect(res.results[0].status).toBe('ACCEPTED');
    expect(res.state.net_total).toBe(5);
    expect(res.state).toHaveProperty('processed_events');
    expect(res.state).toHaveProperty('pending_ack');
    expect(res.state).toHaveProperty('unresolved');
    expect(res.state).toHaveProperty('duplicates');
    expect(res.state).toHaveProperty('conflicts');
  });

  it('repeated identical challenge returns the original response without reprocessing', async () => {
    const first: any = await handleChallenge(pool, challenge(), CAND);
    const second: any = await handleChallenge(pool, challenge(), CAND);
    expect(second).toEqual(first); // byte-identical stored response
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5); // not doubled
    expect(s.duplicates).toBe(0); // events were not resubmitted to the pipeline
    const stored = await pool.query(`SELECT COUNT(*)::int n FROM mqtt_challenges`);
    expect(stored.rows[0].n).toBe(1);
  });

  it('same challenge id with a changed body yields CHALLENGE_CONFLICT', async () => {
    await handleChallenge(pool, challenge(), CAND);
    const changed = challenge({ events: [mqttEvent('EV-M1', 9)] });
    const res: any = await handleChallenge(pool, changed, CAND);
    expect(res.status).toBe('FAILED');
    expect(res.error_code).toBe('CHALLENGE_CONFLICT');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5); // original untouched
  });

  it('expired challenge is rejected before processing', async () => {
    const res: any = await handleChallenge(
      pool,
      challenge({ expires_at: new Date(Date.now() - 1000).toISOString() }),
      CAND,
    );
    expect(res.status).toBe('FAILED');
    expect(res.error_code).toBe('CHALLENGE_EXPIRED');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(0);
  });

  it('mismatched candidate id is rejected', async () => {
    const res: any = await handleChallenge(pool, challenge({ candidate_id: 'CAND-017' }), CAND);
    expect(res.status).toBe('FAILED');
    expect(res.error_code).toBe('CANDIDATE_MISMATCH');
  });

  it('unsupported protocol is rejected', async () => {
    const res: any = await handleChallenge(pool, challenge({ protocol_version: '2.0' }), CAND);
    expect(res.status).toBe('FAILED');
    expect(res.error_code).toBe('UNSUPPORTED_PROTOCOL');
  });

  it('invalid event inside a valid envelope is REJECTED but challenge COMPLETED', async () => {
    const res: any = await handleChallenge(
      pool,
      challenge({ events: [countEvent('LINE-01', 'EV-BAD', 'COUNT', -1)] }),
      CAND,
    );
    expect(res.status).toBe('COMPLETED');
    expect(res.results[0].status).toBe('REJECTED');
  });
});
