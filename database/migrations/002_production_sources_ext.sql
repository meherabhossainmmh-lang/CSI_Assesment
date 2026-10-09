-- ============================================================================
-- 002_production_sources_ext.sql
-- Optional management metadata for production lines (used by the
-- Production Lines page). Sources auto-created by event ingestion keep the
-- defaults (no description, ACTIVE) so ingestion behaviour is unchanged.
-- ============================================================================

ALTER TABLE production_sources
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE production_sources
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE'));
