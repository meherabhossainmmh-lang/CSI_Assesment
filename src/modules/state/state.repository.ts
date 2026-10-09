import type { Queryable, Summary } from '../../shared/types';

const SOURCE_FILTER = '($1::text IS NULL OR source_id = $1)';

/** All six summary figures come from durable rows, never process memory. */
export async function getSummary(db: Queryable, sourceId: string | null): Promise<Summary> {
  const events = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN event_type='COUNT' AND status='ACCEPTED'
                         THEN quantity ELSE 0 END),0) AS count_sum,
       COALESCE(SUM(CASE WHEN event_type='VOID' AND status='ACCEPTED'
                         THEN reversed_quantity ELSE 0 END),0) AS void_sum,
       COUNT(*) FILTER (WHERE status='ACCEPTED') AS processed_events,
       COUNT(*) FILTER (WHERE status='ACCEPTED' AND acknowledged_at IS NULL) AS pending_ack,
       COUNT(*) FILTER (WHERE event_type='VOID' AND status='PENDING_REFERENCE') AS unresolved
     FROM production_events
     WHERE ${SOURCE_FILTER}`,
    [sourceId],
  );

  const attempts = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE classification='DUPLICATE') AS duplicates,
       COUNT(*) FILTER (WHERE classification='CONFLICT') AS conflicts
     FROM submission_attempts
     WHERE ${SOURCE_FILTER}`,
    [sourceId],
  );

  const e = events.rows[0];
  const a = attempts.rows[0];
  return {
    net_total: Number(e.count_sum) - Number(e.void_sum),
    processed_events: Number(e.processed_events),
    pending_ack: Number(e.pending_ack),
    unresolved: Number(e.unresolved),
    duplicates: Number(a.duplicates),
    conflicts: Number(a.conflicts),
  };
}

/** Completed events awaiting supervisor acknowledgement (VOIDs auto-ack). */
export async function getPendingEvents(db: Queryable, sourceId: string | null) {
  const res = await db.query(
    `SELECT event_id, source_id, event_type, quantity, target_event_id,
            event_time, status, received_at
     FROM production_events
     WHERE status='ACCEPTED' AND acknowledged_at IS NULL
       AND ${SOURCE_FILTER}
     ORDER BY received_at ASC, id ASC`,
    [sourceId],
  );
  return res.rows;
}

/**
 * Read-only analytics for the dashboard charts, computed from durable rows:
 * hourly production trend over the last N hours and per-line net totals.
 */
export async function getAnalytics(db: Queryable, hours = 24) {
  const trend = await db.query(
    `WITH buckets AS (
       SELECT generate_series(
         date_trunc('hour', now()) - make_interval(hours => $1),
         date_trunc('hour', now()),
         interval '1 hour') AS bucket
     )
     SELECT to_char(b.bucket, 'YYYY-MM-DD"T"HH24:00:00') AS hour,
       COALESCE(SUM(CASE WHEN e.event_type='COUNT' AND e.status='ACCEPTED'
                         THEN e.quantity ELSE 0 END),0) AS count_total,
       COALESCE(SUM(CASE WHEN e.event_type='VOID' AND e.status='ACCEPTED'
                         THEN e.reversed_quantity ELSE 0 END),0) AS void_total
     FROM buckets b
     LEFT JOIN production_events e ON date_trunc('hour', e.received_at) = b.bucket
     GROUP BY b.bucket
     ORDER BY b.bucket`,
    [hours],
  );

  const byLine = await db.query(
    `SELECT source_id,
       COALESCE(SUM(CASE WHEN event_type='COUNT' AND status='ACCEPTED'
                         THEN quantity ELSE 0 END),0)
       - COALESCE(SUM(CASE WHEN event_type='VOID' AND status='ACCEPTED'
                         THEN reversed_quantity ELSE 0 END),0) AS net_total,
       COUNT(*) FILTER (WHERE status='ACCEPTED') AS processed_events
     FROM production_events
     GROUP BY source_id
     ORDER BY source_id`,
  );

  return {
    trend: trend.rows.map((r) => ({
      hour: r.hour,
      count_total: Number(r.count_total),
      void_total: Number(r.void_total),
      net_total: Number(r.count_total) - Number(r.void_total),
    })),
    by_line: byLine.rows.map((r) => ({
      source_id: r.source_id,
      net_total: Number(r.net_total),
      processed_events: Number(r.processed_events),
    })),
  };
}

/** Unresolved references + rejected submissions + conflict attempts. */
export async function getExceptions(db: Queryable, sourceId: string | null) {
  const res = await db.query(
    `SELECT kind, event_id, source_id, classification, reason, received_at FROM (
       SELECT 'event' AS kind, event_id, source_id, status AS classification,
              COALESCE(rejection_reason, 'VOID awaiting matching COUNT') AS reason,
              received_at
       FROM production_events
       WHERE status IN ('PENDING_REFERENCE','REJECTED') AND ${SOURCE_FILTER}
       UNION ALL
       SELECT 'attempt' AS kind,
              COALESCE(event_id, '(none)') AS event_id,
              COALESCE(source_id, '(none)') AS source_id,
              classification,
              COALESCE(error, '(no detail)') AS reason,
              received_at
       FROM submission_attempts
       WHERE classification IN ('REJECTED','CONFLICT') AND ${SOURCE_FILTER}
     ) combined
     ORDER BY received_at ASC`,
    [sourceId],
  );
  return res.rows;
}
