import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';
import { acknowledgeEvents } from './ack.service';

/** POST /api/ack - { "event_ids": [...] } -> one result per id, in order. */
export async function postAck(req: Request, res: Response, next: NextFunction) {
  try {
    const body = req.body;
    if (body === null || typeof body !== 'object' || Array.isArray(body) || !Array.isArray(body.event_ids)) {
      return res.status(400).json({ error: 'Body must be { "event_ids": [ ... ] }' });
    }
    const ids = body.event_ids as unknown[];
    if (ids.some((id) => typeof id !== 'string' || id.trim() === '')) {
      return res.status(400).json({ error: 'event_ids must be an array of non-empty strings' });
    }
    const results = await acknowledgeEvents(pool, ids as string[]);
    return res.json({ results });
  } catch (err) {
    next(err);
  }
}
