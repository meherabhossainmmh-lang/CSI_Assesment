import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { ensureMigrated, resetDb, submit, countEvent, voidEvent, pool } from '../helpers';
import { acknowledgeEvents } from '../../src/modules/acknowledgement/ack.service';
import { getSummary } from '../../src/modules/state/state.repository';

let server: Server;
let base = '';

beforeAll(async () => {
  await ensureMigrated();
  await new Promise<void>((resolve) => {
    server = createApp().listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
beforeEach(resetDb);

describe('acknowledgement rules', () => {
  it('repeated acknowledgement is safe (ACKED then ALREADY_ACKED)', async () => {
    await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    const first = await acknowledgeEvents(pool, ['EV-101']);
    const second = await acknowledgeEvents(pool, ['EV-101']);
    expect(first[0].status).toBe('ACKED');
    expect(second[0].status).toBe('ALREADY_ACKED');
  });

  it('duplicate id within one request becomes ALREADY_ACKED on second copy', async () => {
    await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    const res = await acknowledgeEvents(pool, ['EV-101', 'EV-101']);
    expect(res.map((r) => r.status)).toEqual(['ACKED', 'ALREADY_ACKED']);
  });

  it('NOT_FOUND for unknown id and NOT_READY for unresolved VOID', async () => {
    await submit(voidEvent('LINE-01', 'EV-P', 'EV-MISSING'));
    const res = await acknowledgeEvents(pool, ['EV-NOPE', 'EV-P']);
    expect(res[0].status).toBe('NOT_FOUND');
    expect(res[1].status).toBe('NOT_READY');
  });

  it('pending_ack decreases after acknowledgement', async () => {
    await submit(countEvent('LINE-01', 'EV-101', 'COUNT', 5));
    let s = await getSummary(pool, null);
    expect(s.pending_ack).toBe(1);
    await acknowledgeEvents(pool, ['EV-101']);
    s = await getSummary(pool, null);
    expect(s.pending_ack).toBe(0);
  });
});

describe('REST HTTP contract', () => {
  it('POST /api/events returns 200 for a single object and an array', async () => {
    const single = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(countEvent('LINE-01', 'EV-1', 'COUNT', 1)),
    });
    expect(single.status).toBe(200);

    const batch = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([countEvent('LINE-01', 'EV-2', 'COUNT', 1)]),
    });
    expect(batch.status).toBe(200);
    const batchJson: any = await batch.json();
    expect(Array.isArray(batchJson.results)).toBe(true);
  });

  it('POST /api/events returns 400 for a non-interpretable top level', async () => {
    const bad = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify('just a string'),
    });
    expect(bad.status).toBe(400);
  });

  it('GET /api/state validates the view parameter', async () => {
    const ok = await fetch(`${base}/api/state?view=summary`);
    expect(ok.status).toBe(200);
    const bad = await fetch(`${base}/api/state?view=bogus`);
    expect(bad.status).toBe(400);
  });

  it('POST /api/ack rejects a malformed body with 400', async () => {
    const bad = await fetch(`${base}/api/ack`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nope: true }),
    });
    expect(bad.status).toBe(400);
  });

  it('preserves original order of results in a batch', async () => {
    const res = await fetch(`${base}/api/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([
        countEvent('LINE-01', 'EV-A', 'COUNT', 1),
        { bad: true },
        countEvent('LINE-01', 'EV-B', 'COUNT', 2),
      ]),
    });
    const json: any = await res.json();
    expect(json.results.map((r: any) => r.status)).toEqual(['ACCEPTED', 'REJECTED', 'ACCEPTED']);
  });
});
