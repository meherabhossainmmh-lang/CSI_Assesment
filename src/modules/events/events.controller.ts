import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';
import { interpretBatch } from './events.validation';
import { processEvents } from './events.service';

/** POST /api/events - one event object or an array; one result per item. */
export async function postEvents(req: Request, res: Response, next: NextFunction) {
  try {
    const items = interpretBatch(req.body); // throws -> 400 via errorHandler
    const results = await processEvents(pool, items, 'REST');
    res.status(200).json({ results });
  } catch (err) {
    next(err);
  }
}
