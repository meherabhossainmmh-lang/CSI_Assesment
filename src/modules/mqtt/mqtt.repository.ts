import type { Queryable } from '../../shared/types';

export interface StoredChallenge {
  id: number;
  challenge_id: string;
  candidate_id: string | null;
  request_body: unknown;
  request_digest: string;
  response_body: any;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error_code: string | null;
  error_message: string | null;
  received_at: Date;
  processed_at: Date | null;
}

export async function findChallenge(db: Queryable, challengeId: string): Promise<StoredChallenge | null> {
  const res = await db.query(`SELECT * FROM mqtt_challenges WHERE challenge_id = $1`, [challengeId]);
  return res.rows[0] ?? null;
}

/** Claim a challenge id; returns null if another caller already owns it. */
export async function insertChallenge(
  db: Queryable,
  input: { challengeId: string; candidateId: string | null; body: unknown; digest: string },
): Promise<StoredChallenge | null> {
  const res = await db.query(
    `INSERT INTO mqtt_challenges (challenge_id, candidate_id, request_body, request_digest, status)
     VALUES ($1,$2,$3,$4,'PROCESSING')
     ON CONFLICT ON CONSTRAINT uq_challenges_id DO NOTHING
     RETURNING *`,
    [input.challengeId, input.candidateId, JSON.stringify(input.body), input.digest],
  );
  return res.rows[0] ?? null;
}

export async function updateChallenge(
  db: Queryable,
  id: number,
  patch: Partial<StoredChallenge>,
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = $${i++}`);
    values.push(value);
  }
  values.push(id);
  await db.query(`UPDATE mqtt_challenges SET ${fields.join(', ')} WHERE id = $${i}`, values);
}
