-- Phase 6a: triage primitives — star ratings and color labels.
--
-- `rating` is 0..5; 0 means "unrated" and is the implicit default for every
-- existing row. `color_label` is a small fixed palette stored as text so
-- adding/removing colors stays a code change rather than a migration.
--
-- Both indexes are PARTIAL so they stay cheap in libraries where most files
-- are untouched — exactly the common case.

ALTER TABLE files ADD COLUMN rating INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN color_label TEXT;
CREATE INDEX idx_files_rating ON files(rating) WHERE rating > 0;
CREATE INDEX idx_files_label ON files(color_label) WHERE color_label IS NOT NULL;
