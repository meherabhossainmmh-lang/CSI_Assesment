import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ensureMigrated, resetDb, submit, countEvent, voidEvent, pool } from '../helpers';
import { getSummary } from '../../src/modules/state/state.repository';

beforeAll(ensureMigrated);
beforeEach(resetDb);

describe('concurrent delivery protection', () => {
  it('concurrent identical COUNT submissions are counted exactly once', async () => {
    const same = countEvent('LINE-01', 'EV-RACE', 'COUNT', 5);
    const results = await Promise.all([
      submit(same),
      submit(same),
      submit(same),
      submit(same),
      submit(same),
    ]);
    const statuses = results.flat().map((r) => r.status);
    expect(statuses.filter((s) => s === 'ACCEPTED')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'DUPLICATE')).toHaveLength(4);
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(5); // counted once, not five times
  });

  it('concurrent competing VOIDs reverse a COUNT only once', async () => {
    await submit(countEvent('LINE-01', 'EV-C', 'COUNT', 7));
    const [a, b] = await Promise.all([
      submit(voidEvent('LINE-01', 'EV-VA', 'EV-C')),
      submit(voidEvent('LINE-01', 'EV-VB', 'EV-C')),
    ]);
    const statuses = [a[0].status, b[0].status].sort();
    // exactly one applied, the other rejected (already reversed)
    expect(statuses).toEqual(['ACCEPTED', 'REJECTED']);
    const s = await getSummary(pool, null);
    expect(s.net_total).toBe(0); // reversed once, never double-subtracted
    const reversed = await pool.query(
      `SELECT COUNT(*)::int AS n FROM production_events
       WHERE event_type='VOID' AND status='ACCEPTED' AND target_event_id='EV-C'`,
    );
    expect(reversed.rows[0].n).toBe(1);
  });
});
