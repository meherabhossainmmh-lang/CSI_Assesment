-- ============================================================================
-- 001_init.sql  -  core schema for the production event processing backend
-- Identity of a logical event is the composite (source_id, event_id).
-- See TECHNICAL_EXPLANATION.md for the uniqueness/atomicity assumptions.
-- ============================================================================

-- Production lines / devices that report counts.
CREATE TABLE IF NOT EXISTS production_sources (
    source_id    TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Logical COUNT and VOID events. One row per logical event; never deleted,
-- corrections are represented as separate VOID rows (history preserved).
CREATE TABLE IF NOT EXISTS production_events (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           TEXT NOT NULL
                        REFERENCES production_sources(source_id) ON UPDATE CASCADE,
    event_id            TEXT NOT NULL,
    event_type          TEXT NOT NULL CHECK (event_type IN ('COUNT','VOID')),
    quantity            INTEGER,
    target_event_id     TEXT,
    event_time          TIMESTAMPTZ NOT NULL,
    status              TEXT NOT NULL
                        CHECK (status IN ('ACCEPTED','PENDING_REFERENCE','REJECTED')),
    normalized_hash     TEXT NOT NULL,
    normalized_payload  JSONB NOT NULL,
    received_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_at     TIMESTAMPTZ,
    -- For a COUNT: event_id of the single VOID that reversed it (NULL until voided).
    reversed_by_event_id TEXT,
    -- For a VOID: quantity reversed from the target COUNT once applied.
    reversed_quantity   INTEGER,
    rejection_reason    TEXT,

    -- Composite identity: the same event_id may legitimately appear on two
    -- different lines, but never twice on the same line.
    CONSTRAINT uq_events_source_event UNIQUE (source_id, event_id),

    -- Shape invariants per type.
    CONSTRAINT chk_events_shape CHECK (
        (event_type = 'COUNT' AND target_event_id IS NULL
             AND quantity IS NOT NULL AND quantity > 0)
        OR
        (event_type = 'VOID' AND target_event_id IS NOT NULL
             AND quantity IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_events_event_id   ON production_events (event_id);
CREATE INDEX IF NOT EXISTS idx_events_type_status ON production_events (event_type, status);
CREATE INDEX IF NOT EXISTS idx_events_target      ON production_events (source_id, target_event_id);
CREATE INDEX IF NOT EXISTS idx_events_pending_ack ON production_events (acknowledged_at)
    WHERE acknowledged_at IS NULL;

-- Every received item (accepted, duplicate, conflict, rejected, pending) is
-- recorded here exactly once, giving a durable audit trail.
CREATE TABLE IF NOT EXISTS submission_attempts (
    id                 BIGSERIAL PRIMARY KEY,
    received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    channel            TEXT NOT NULL DEFAULT 'REST' CHECK (channel IN ('REST','MQTT')),
    challenge_id       TEXT,
    raw_payload        JSONB NOT NULL,
    source_id          TEXT,
    event_id           TEXT,
    classification     TEXT NOT NULL
                       CHECK (classification IN
                              ('ACCEPTED','DUPLICATE','CONFLICT','PENDING_REFERENCE','REJECTED')),
    error              TEXT,
    normalized_payload JSONB,
    normalized_hash    TEXT
);

CREATE INDEX IF NOT EXISTS idx_attempts_class    ON submission_attempts (classification);
CREATE INDEX IF NOT EXISTS idx_attempts_ids      ON submission_attempts (source_id, event_id);
CREATE INDEX IF NOT EXISTS idx_attempts_received ON submission_attempts (received_at);

-- Durable MQTT challenge/response history for replay + conflict detection.
CREATE TABLE IF NOT EXISTS mqtt_challenges (
    id              BIGSERIAL PRIMARY KEY,
    challenge_id    TEXT NOT NULL,
    candidate_id    TEXT,
    request_body    JSONB NOT NULL,
    request_digest  TEXT NOT NULL,
    response_body   JSONB,
    status          TEXT NOT NULL CHECK (status IN ('PROCESSING','COMPLETED','FAILED')),
    error_code      TEXT,
    error_message   TEXT,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at    TIMESTAMPTZ,

    CONSTRAINT uq_challenges_id UNIQUE (challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenges_status   ON mqtt_challenges (status);
CREATE INDEX IF NOT EXISTS idx_challenges_received ON mqtt_challenges (received_at);
