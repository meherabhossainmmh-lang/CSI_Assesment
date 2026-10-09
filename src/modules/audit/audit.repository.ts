import type { Queryable } from '../../shared/types';

/** Read helpers used by the support/engineering view of the audit trail. */

export async function recentSubmissionAttempts(db: Queryable, limit = 50) {
  const res = await db.query(
    `SELECT id, received_at, channel, challenge_id, source_id, event_id,
            classification, error
     FROM submission_attempts
     ORDER BY received_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}

export async function recentChallenges(db: Queryable, limit = 20) {
  const res = await db.query(
    `SELECT id, challenge_id, candidate_id, status, error_code, received_at, processed_at
     FROM mqtt_challenges
     ORDER BY received_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows;
}
