import type { Queryable } from '../../shared/types';

export interface SourceRow {
  source_id: string;
  display_name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: Date;
}

export async function listSources(db: Queryable): Promise<SourceRow[]> {
  const res = await db.query(
    `SELECT source_id, display_name, description, status, created_at
     FROM production_sources ORDER BY source_id`,
  );
  return res.rows;
}

export async function getSource(db: Queryable, sourceId: string): Promise<SourceRow | null> {
  const res = await db.query(
    `SELECT source_id, display_name, description, status, created_at
     FROM production_sources WHERE source_id = $1`,
    [sourceId],
  );
  return res.rows[0] ?? null;
}

export async function insertSource(
  db: Queryable,
  input: { source_id: string; display_name: string; description: string | null },
): Promise<SourceRow | null> {
  const res = await db.query(
    `INSERT INTO production_sources (source_id, display_name, description)
     VALUES ($1,$2,$3)
     ON CONFLICT (source_id) DO NOTHING
     RETURNING source_id, display_name, description, status, created_at`,
    [input.source_id, input.display_name, input.description],
  );
  return res.rows[0] ?? null;
}

export async function updateSource(
  db: Queryable,
  sourceId: string,
  patch: Partial<{ display_name: string; description: string | null; status: 'ACTIVE' | 'INACTIVE' }>,
): Promise<SourceRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = $${i++}`);
    values.push(value);
  }
  if (fields.length === 0) return getSource(db, sourceId);
  values.push(sourceId);
  const res = await db.query(
    `UPDATE production_sources SET ${fields.join(', ')}
     WHERE source_id = $${i}
     RETURNING source_id, display_name, description, status, created_at`,
    values,
  );
  return res.rows[0] ?? null;
}
