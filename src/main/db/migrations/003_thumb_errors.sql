-- Phase 5: persistent failure tracking for thumbnail rendering.
--
-- Before this, thumb_jobs.last_error was the only failure record, but the job
-- table is volatile (jobs come and go) and the queue runner re-claimed
-- failed jobs forever. This table records that we already tried to render a
-- file, captures why it failed, and lets the reconciler skip files until
-- either the source mtime changes or the renderer code is bumped.
--
-- The compound (source_mtime_ms, renderer_version) acts as the cache key:
-- if EITHER changes after a failure, the file becomes eligible for retry on
-- its own without manual intervention.

CREATE TABLE IF NOT EXISTS thumb_errors (
  file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  error TEXT NOT NULL,
  failed_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  source_mtime_ms INTEGER NOT NULL,
  renderer_version INTEGER NOT NULL
);
