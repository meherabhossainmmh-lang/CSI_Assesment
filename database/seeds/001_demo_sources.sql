-- Optional convenience seed: pre-register two demo production lines.
-- Safe to run repeatedly. NOT required for the app or tests to work.
INSERT INTO production_sources (source_id, display_name)
VALUES ('LINE-01', 'Line 01'), ('LINE-02', 'Line 02')
ON CONFLICT (source_id) DO NOTHING;
