import type { Request, Response, NextFunction } from 'express';
import { pool } from '../../config/database';
import { getMqttRuntimeStatus } from './mqtt.status';
import { recentChallengeDetails } from './mqtt.repository';

/**
 * GET /api/mqtt/status - read-only view of the worker's runtime health plus
 * the durable recent challenge history. No credentials are ever exposed.
 */
export async function getMqttStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const runtime = getMqttRuntimeStatus();
    const recent = await recentChallengeDetails(pool, 10);
    res.json({ ...runtime, recent_challenges: recent });
  } catch (err) {
    next(err);
  }
}
