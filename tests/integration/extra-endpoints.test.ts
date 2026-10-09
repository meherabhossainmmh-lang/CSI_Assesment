import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { ensureMigrated, resetDb, submit, countEvent, pool } from '../helpers';
import { handleChallenge } from '../../src/modules/mqtt/mqtt.service';

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

describe('production lines endpoints', () => {
  it('creates, lists and updates a production line', async () => {
    const created = await fetch(`${base}/api/production-lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source_id: 'LINE-X', display_name: 'Line X', description: 'demo' }),
    });
    expect(created.status).toBe(201);

    const list: any = await (await fetch(`${base}/api/production-lines`)).json();
    expect(list.lines.some((l: any) => l.source_id === 'LINE-X')).toBe(true);

    const patch = await fetch(`${base}/api/production-lines/LINE-X`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'INACTIVE', display_name: 'Line X renamed' }),
    });
    const patchJson: any = await patch.json();
    expect(patchJson.line.status).toBe('INACTIVE');
    expect(patchJson.line.display_name).toBe('Line X renamed');
  });

  it('rejects duplicate line creation with 409 and bad ids with 400', async () => {
    await fetch(`${base}/api/production-lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source_id: 'LINE-Y', display_name: 'Line Y' }),
    });
    const dup = await fetch(`${base}/api/production-lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source_id: 'LINE-Y', display_name: 'again' }),
    });
    expect(dup.status).toBe(409);

    const bad = await fetch(`${base}/api/production-lines`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source_id: 'bad id!', display_name: 'x' }),
    });
    expect(bad.status).toBe(400);
  });

  it('auto-registered sources from events appear in the list', async () => {
    await submit(countEvent('LINE-01', 'EV-1', 'COUNT', 1));
    const list: any = await (await fetch(`${base}/api/production-lines`)).json();
    expect(list.lines.some((l: any) => l.source_id === 'LINE-01')).toBe(true);
  });
});

describe('analytics endpoint', () => {
  it('returns durable trend and per-line totals', async () => {
    await submit(countEvent('LINE-01', 'EV-1', 'COUNT', 5));
    const res: any = await (await fetch(`${base}/api/analytics?hours=24`)).json();
    expect(Array.isArray(res.trend)).toBe(true);
    expect(res.trend.length).toBe(25);
    const line = res.by_line.find((l: any) => l.source_id === 'LINE-01');
    expect(line.net_total).toBe(5);
  });
});

describe('mqtt status endpoint', () => {
  it('exposes runtime status and recent challenge history without secrets', async () => {
    await handleChallenge(
      pool,
      {
        protocol_version: '1.0',
        candidate_id: '08',
        challenge_id: 'CH-STAT-1',
        command: 'PROCESS_EVENTS',
        expires_at: '2030-01-01T00:00:00Z',
        events: [countEvent('LINE-01', 'EV-9', 'COUNT', 2)],
      },
      '08',
    );
    const res: any = await (await fetch(`${base}/api/mqtt/status`)).json();
    expect(res).toHaveProperty('connected');
    expect(res).toHaveProperty('candidate_id', '08');
    expect(res).toHaveProperty('recent_challenges');
    expect(res.recent_challenges.some((c: any) => c.challenge_id === 'CH-STAT-1')).toBe(true);
    // no credentials leaked
    expect(JSON.stringify(res)).not.toMatch(/password|secret|token/i);
  });
});
