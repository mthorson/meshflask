CREATE TABLE library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  rel_path TEXT NOT NULL UNIQUE,
  parent_dir TEXT NOT NULL,
  filename TEXT NOT NULL,
  ext TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  mtime_ms INTEGER NOT NULL,
  sha256 TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_files_parent ON files(parent_dir);
CREATE INDEX idx_files_sha ON files(sha256);

CREATE TABLE thumbnails (
  file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
  thumb_rel_path TEXT NOT NULL,
  rendered_at INTEGER NOT NULL,
  source_mtime_ms INTEGER NOT NULL,
  source_sha256 TEXT,
  renderer_version INTEGER NOT NULL
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE file_tags (
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (file_id, tag_id)
);

CREATE TABLE thumb_jobs (
  id INTEGER PRIMARY KEY,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  enqueued_at INTEGER NOT NULL,
  claimed_at INTEGER,
  claimed_by TEXT
);
CREATE INDEX idx_jobs_avail ON thumb_jobs(claimed_at, priority DESC);

CREATE VIRTUAL TABLE files_fts USING fts5(
  filename, tags, metadata,
  content=''
);
