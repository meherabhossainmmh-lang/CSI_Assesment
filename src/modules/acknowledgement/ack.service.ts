import type { Pool } from 'pg';
import { withTransaction } from '../../config/database';
import { lockEventsByEventId, setAcknowledged } from './ack.repository';
import { emitDomainEvent } from '../../shared/domainEvents';
import type { AckResult } from '../../shared/types';

/**
 * Acknowledge a list of event ids, in order, atomically. Repeated requests are
 * safe: an id acknowledged earlier (or twice within one request) yields
 * ALREADY_ACKED. Acknowledgement never deletes history.
 */
export async function acknowledgeEvents(pool: Pool, eventIds: string[]): Promise<AckResult[]> {
  const facts: Array<{ event_id: string }> = [];
  const results = await withTransaction(pool, async (client) => {
    const out: AckResult[] = [];
    for (const eventId of eventIds) {
      const matches = await lockEventsByEventId(client, eventId);
      if (matches.length === 0) {
        out.push({ event_id: eventId, status: 'NOT_FOUND', message: 'No logical event with this ID' });
        continue;
      }

      // Earliest stored logical event wins for bare-id resolution.
      const row = matches[0];

      if (row.acknowledged_at) {
        out.push({ event_id: eventId, status: 'ALREADY_ACKED', message: 'Already acknowledged earlier' });
        continue;
      }
      if (row.status !== 'ACCEPTED') {
        out.push({
          event_id: eventId,
          status: 'NOT_READY',
          message: row.status === 'PENDING_REFERENCE'
            ? 'Event is an unresolved VOID reference'
            : 'Event was rejected and cannot be acknowledged',
        });
        continue;
      }

      await setAcknowledged(client, row.id, new Date());
      facts.push({ event_id: eventId });
      out.push({ event_id: eventId, status: 'ACKED', message: 'Acknowledged' });
    }
    return out;
  });

  for (const f of facts) emitDomainEvent('EVENT_ACKNOWLEDGED', f);
  return results;
}
