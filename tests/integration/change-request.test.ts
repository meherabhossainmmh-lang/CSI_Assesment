import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureMigrated, resetDb, submit, pool } from '../helpers';
import { getSummary } from '../../src/modules/state/state.repository';
import { handleChallenge } from '../../src/modules/mqtt/mqtt.service';

beforeAll(ensureMigrated);
beforeEach(resetDb);

const T = '2026-10-09T10:30:00Z';
function mk(source: string, id: string, type: 'COUNT' | 'VOID', quantity?: unknown, target?: string) {
  const ev: Record<string, unknown> = { source_id: source, event_id: id, type, event_time: T };
  if (type === 'COUNT') ev.quantity = quantity;
  if (type === 'VOID') ev.target_event_id = target;
  return ev;
}

describe('Change 01 - COUNT quantity bounded to 1..500', () => {
  it.each([1, 450, 500])('COUNT %i is ACCEPTED', async (q) => {
    const res = await submit(mk('LINE-01', `EV-${q}`, 'COUNT', q));
    expect(res[0].status).toBe('ACCEPTED');
  });

  it.each([501, 600, 0, -5])('COUNT %i is REJECTED', async (q) => {
    const res = await submit(mk('LINE-01', `EV-R${q}`, 'COUNT', q));
    expect(res[0].status).toBe('REJECTED');
    expect(res[0].message).toMatch(/between 1 and 500/);
  });

  it.each([2.5, 'abc', null, {}, undefined as unknown])('COUNT quantity %j is REJECTED', async (q) => {
    const res = await submit(mk('LINE-01', 'EV-BAD', 'COUNT', q));
    expect(res[0].status).toBe('REJECTED');
  });

  it('rejected COUNT does not change Net Total and is stored', async () => {
    await submit(mk('LINE-01', 'EV-OK', 'COUNT', 500));
    await submit(mk('LINE-01', 'EV-OVER', 'COUNT', 501));
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(500);
    const stored = await pool.query(
      `SELECT classification, error FROM submission_attempts WHERE event_id='EV-OVER'`,
    );
    expect(stored.rows[0].classification).toBe('REJECTED');
    expect(stored.rows[0].error).toMatch(/between 1 and 500/);
    // no successful logical COUNT created for the rejected one
    const logical = await pool.query(`SELECT COUNT(*)::int n FROM production_events WHERE event_id='EV-OVER'`);
    expect(logical.rows[0].n).toBe(0);
  });
});

describe('Change 02 - rejected_submissions in summary', () => {
  it('counts only REJECTED attempts, supports source filter, and returns 0 when none', async () => {
    // LINE-01: 2 rejected, 1 duplicate, 1 conflict, 1 pending
    await submit(mk('LINE-01', 'EV-A', 'COUNT', 501)); // rejected
    await submit(mk('LINE-01', 'EV-B', 'COUNT', 600)); // rejected
    const dup = mk('LINE-01', 'EV-C', 'COUNT', 5);
    await submit(dup);
    await submit(dup); // duplicate
    await submit(mk('LINE-01', 'EV-C', 'COUNT', 9)); // conflict
    await submit(mk('LINE-01', 'EV-V', 'VOID', undefined, 'EV-MISSING')); // pending_reference
    // LINE-02: 1 rejected
    await submit(mk('LINE-02', 'EV-D', 'COUNT', 501));

    const all = await getSummary(pool, null);
    expect(all.rejected_submissions).toBe(3);
    expect(all.duplicates).toBe(1);
    expect(all.conflicts).toBe(1);
    // existing six fields still present
    for (const k of ['net_total', 'processed_events', 'pending_ack', 'unresolved', 'duplicates', 'conflicts']) {
      expect(all).toHaveProperty(k);
    }

    expect((await getSummary(pool, 'LINE-01')).rejected_submissions).toBe(2);
    expect((await getSummary(pool, 'LINE-02')).rejected_submissions).toBe(1);
  });

  it('returns 0 when there are no rejected submissions', async () => {
    await submit(mk('LINE-01', 'EV-1', 'COUNT', 5));
    const s = await getSummary(pool, null);
    expect(s.rejected_submissions).toBe(0);
  });
});

describe('Change 01/02 over MQTT - shared validation and summary', () => {
  function challenge(id: string, events: unknown[]) {
    return {
      protocol_version: '1.0',
      candidate_id: '08',
      challenge_id: id,
      command: 'PROCESS_EVENTS',
      expires_at: '2030-01-01T00:00:00Z',
      events,
    };
  }

  it('MQTT applies the same quantity bound and reports rejected_submissions in state', async () => {
    const over: any = await handleChallenge(pool, challenge('CH-1', [mk('LINE-01', 'EV-M501', 'COUNT', 501)]), '08');
    expect(over.status).toBe('COMPLETED');
    expect(over.results[0].status).toBe('REJECTED');
    expect(over.state.rejected_submissions).toBe(1);

    const ok: any = await handleChallenge(pool, challenge('CH-2', [mk('LINE-01', 'EV-M450', 'COUNT', 450)]), '08');
    expect(ok.results[0].status).toBe('ACCEPTED');
    expect(ok.state.net_total).toBe(450);
    expect(ok.state).toHaveProperty('rejected_submissions');
  });
});
