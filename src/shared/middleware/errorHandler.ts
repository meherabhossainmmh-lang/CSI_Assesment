import type { Request, Response, NextFunction } from 'express';
import { UninterpretableBodyError } from '../../modules/events/events.validation';

/** Central error handler: maps known errors to clean 4xx, hides internals. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof UninterpretableBodyError) {
    return res.status(400).json({ error: err.message });
  }

  // Malformed JSON / wrong content type surfaced by express.json.
  if (err && typeof err === 'object' && (err as any).type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON' });
  }
  if (err && typeof err === 'object' && (err as any).type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large' });
  }

  console.error('[http] unhandled error:', err);
  // Never leak SQL/stack details to API consumers.
  return res.status(500).json({ error: 'Internal server error' });
}

export function notFoundHandler(_req: Request, res: Response) {
  return res.status(404).json({ error: 'Not found' });
}
