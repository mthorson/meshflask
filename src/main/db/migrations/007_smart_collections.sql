-- Phase 6b: Smart Collections — collections whose membership is derived from
-- a saved query rather than a manually-curated `collection_files` list.
--
-- When `query_json` is non-null the collection is "smart". Its membership is
-- recomputed every time it's viewed by re-running the stored filters through
-- `files.query()`. `collection_files` rows are never written for smart
-- collections — that table remains the single source of truth for manual ones.

ALTER TABLE collections ADD COLUMN query_json TEXT;
