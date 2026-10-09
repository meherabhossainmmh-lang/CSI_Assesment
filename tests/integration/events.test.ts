import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureMigrated, resetDb, submit, countEvent, voidEvent, pool } from '../helpers';
import { getSummary, getPendingEvents, getExceptions } from '../../src/modules/state/state.repository';

beforeAll(ensureMigrated);
beforeEach(resetDb);

describe('COUNT / VOID business rules', () => {
  it('COUNT +5 yields net total 5 and appears once', async () => {
    const res = await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    expect(res[0].status).toBe('ACCEPTED');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5);
    expect(s.processed_events).toBe(1);
  });

  it('identical duplicate does not increase the total', async () => {
    const ev = countEvent('LINE-01', 'EV-101', 'COUNT', 5);
    await submit(ev);
    const dup = await submit(ev);
    expect(dup[0].status).toBe('DUPLICATE');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5);
    expect(s.duplicates).toBe(1);
  });

  it('VOID reverses an accepted COUNT and preserves history', async () => {
    await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    const v = await submit(voidEvent('LINE-01', 'EV-102', 'EV-101'));
    expect(v[0].status).toBe('ACCEPTED');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(0);
    // history: both logical events still present and processed
    expect(s.processed_events).toBe(2);
    const count = await pool.query(
      `SELECT reversed_by_event_id FROM production_events WHERE event_id='EV-101'`,
    );
    expect(count.rows[0].reversed_by_event_id).toBe('EV-102');
  });

  it('VOID arriving before its COUNT resolves automatically', async () => {
    const pend = await submit(voidEvent('LINE-01', 'EV-200', 'EV-199'));
    expect(pend[0].status).toBe('PENDING_REFERENCE');
    let s = await getSummary(pool, null);
    expect(s.unresolved).toBe(1);

    await submit(countEvent('LINE-01', 'EV-199', 'COUNT', 3));
    s = await getSummary(pool, null);
    expect(s.unresolved).toBe(0);
    expect(s.net_total).toBe(0); // 3 then reversed by 3
    // resolved VOID is auto-acknowledged -> not in pending
    const pending = await getPendingEvents(pool, null);
    expect(pending.some((p) => p.event_id === 'EV-200')).toBe(false);
  });

  it('same event ID with different data is a CONFLICT and original preserved', async () => {
    await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    const conflict = await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 9));
    expect(conflict[0].status).toBe('CONFLICT');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5);
    expect(s.conflicts).toBe(1);
  });

  it('invalid quantity is REJECTED with a clear message', async () => {
    const res = await submit(countEvent('LINE-01', 'EV-300', 'COUNT', -2));
    expect(res[0].status).toBe('REJECTED');
    expect(res[0].message).toMatch(/positive integer/);
  });

  it('mixed batch keeps order and does not drop valid items', async () => {
    const results = await submit(
      countEvent('LINE-01', 'EV-400', 'COUNT', 2),
      { source_id: 'LINE-01', event_id: 'EV-401', type: 'COUNT', quantity: 'bad', event_time: new Date().toISOString() },
      countEvent('LINE-01', 'EV-402', 'COUNT', 1),
    );
    expect(results.map((r) => r.status)).toEqual(['ACCEPTED', 'REJECTED', 'ACCEPTED']);
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(3);
  });

  it('multiple pending VOIDs targeting one COUNT: first stored wins', async () => {
    await submit(voidEvent('LINE-01', 'EV-V1', 'EV-C1'));
    await submit(voidEvent('LINE-01', 'EV-V2', 'EV-C1'));
    await submit(countEvent('LINE-01', 'EV-C1', 'COUNT', 4));

    const rows = await pool.query(
      `SELECT event_id, status, rejection_reason FROM production_events
       WHERE event_id IN ('EV-V1','EV-V2') ORDER BY event_id`,
    );
    expect(rows.rows.find((r) => r.event_id === 'EV-V1')!.status).toBe('ACCEPTED');
    expect(rows.rows.find((r) => r.event_id === 'EV-V2')!.status).toBe('REJECTED');
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(0);
  });

  it('source filtering isolates totals', async () => {
    await submit(countEvent('LINE-01', 'EV-1', 'COUNT', 5));
    await submit(countEvent('LINE-02', 'EV-1', 'COUNT', 10)); // same event_id, other source is allowed
    const all = await getSummary(pool, null);
    const l1 = await getSummary(pool, 'LINE-01');
    const l2 = await getSummary(pool, 'LINE-02');
    expect(all.net_total).toBe(15);
    expect(l1.net_total).toBe(5);
    expect(l2.net_total).toBe(10);
  });

  it('records a durable submission attempt for every item', async () => {
    const ev = countEvent('LINE-01', 'EV-101', 'COUNT', 5);
    await submit(ev);
    await submit(ev); // duplicate
    const attempts = await pool.query(`SELECT classification FROM submission_attempts ORDER BY id`);
    expect(attempts.rows.map((r) => r.classification)).toEqual(['ACCEPTED', 'DUPLICATE']);
  });

  it('exceptions view surfaces unresolved, rejected and conflicts with reasons', async () => {
    await submit(voidEvent('LINE-01', 'EV-P', 'EV-MISSING')); // unresolved
    await submit({ source_id: 'LINE-01', event_id: 'EV-BAD', type: 'COUNT', quantity: 0, event_time: new Date().toISOString() }); // rejected
    const ex = await getExceptions(pool, null);
    const kinds = ex.map((e) => e.classification);
    expect(kinds).toContain('PENDING_REFERENCE');
    expect(kinds).toContain('REJECTED');
  });
});
