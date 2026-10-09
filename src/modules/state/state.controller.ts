import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';
import { getSummary, getPendingEvents, getExceptions, getAnalytics } from './state.repository';

const VIEWS = ['summary', 'pending', 'exceptions'] as const;
type View = (typeof VIEWS)[number];

/** GET /api/state?source_id=&view= */
export async function getState(req: Request, res: Response, next: NextFunction) {
  try {
    const rawView = (req.query.view as string) || 'summary';
    if (!VIEWS.includes(rawView as View)) {
      return res.status(400).json({ error: `view must be one of: ${VIEWS.join(', ')}` });
    }
    const view = rawView as View;
    const sourceId =
      typeof req.query.source_id === 'string' && req.query.source_id.trim()
        ? req.query.source_id.trim()
        : null;

    if (view === 'summary') {
      const summary = await getSummary(pool, sourceId);
      return res.json({ view, source_id: sourceId, summary });
    }
    if (view === 'pending') {
      const pending = await getPendingEvents(pool, sourceId);
      return res.json({ view, source_id: sourceId, pending });
    }
    const exceptions = await getExceptions(pool, sourceId);
    return res.json({ view, source_id: sourceId, exceptions });
  } catch (err) {
    next(err);
  }
}

/** GET /api/analytics?hours=24 - durable trend + per-line figures for charts. */
export async function getAnalyticsView(req: Request, res: Response, next: NextFunction) {
  try {
    const hoursRaw = Number.parseInt((req.query.hours as string) || '24', 10);
    const hours = Number.isFinite(hoursRaw) && hoursRaw > 0 && hoursRaw <= 168 ? hoursRaw : 24;
    const analytics = await getAnalytics(pool, hours);
    return res.json({ hours, ...analytics });
  } catch (err) {
    next(err);
  }
}
