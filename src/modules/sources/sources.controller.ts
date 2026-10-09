import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database';
import { listSources, getSource, insertSource, updateSource } from './sources.repository';

const SOURCE_ID = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/, 'source_id may use letters, digits, . _ -');

const createSchema = z.object({
  source_id: SOURCE_ID,
  display_name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
});

const updateSchema = z.object({
  display_name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function getLines(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({ lines: await listSources(pool) });
  } catch (err) {
    next(err);
  }
}

export async function createLine(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const { source_id, display_name, description } = parsed.data;
    const row = await insertSource(pool, { source_id, display_name, description: description ?? null });
    if (!row) return res.status(409).json({ error: 'Production line already exists' });
    return res.status(201).json({ line: row });
  } catch (err) {
    next(err);
  }
}

export async function updateLine(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.display_name !== undefined) patch.display_name = parsed.data.display_name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;

    const row = await updateSource(pool, req.params.source_id, patch as any);
    if (!row) return res.status(404).json({ error: 'Production line not found' });
    return res.json({ line: row });
  } catch (err) {
    next(err);
  }
}
