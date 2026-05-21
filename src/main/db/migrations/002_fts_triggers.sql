-- Phase 4: full-text search triggers + backfill.
--
-- 001 created files_fts with content='' (contentless), which doesn't allow
-- DELETE/UPDATE in normal SQL — only via FTS5's special 'delete' command.
-- Triggers can't easily emit that command because they don't know the current
-- column values. Drop and recreate as a regular FTS5 table so DELETE/UPDATE
-- work, then attach triggers that mirror files + file_tags state.
--
-- The rowid in files_fts is always files.id so the FTS query results join
-- back to the files table cleanly.

DROP TABLE IF EXISTS files_fts;

CREATE VIRTUAL TABLE files_fts USING fts5(
  filename,
  tags,
  metadata
);

-- ─── files lifecycle ─────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS files_fts_after_insert
AFTER INSERT ON files
BEGIN
  INSERT INTO files_fts (rowid, filename, tags, metadata)
  VALUES (new.id, new.filename, '', COALESCE(new.metadata_json, ''));
END;

CREATE TRIGGER IF NOT EXISTS files_fts_after_delete
AFTER DELETE ON files
BEGIN
  DELETE FROM files_fts WHERE rowid = old.id;
END;

-- Updates of filename change the search content for that row. Touching
-- updated_at alone (which the scanner does on every walk) does NOT fire this
-- trigger because we list the column explicitly.
CREATE TRIGGER IF NOT EXISTS files_fts_after_update_filename
AFTER UPDATE OF filename ON files
BEGIN
  DELETE FROM files_fts WHERE rowid = old.id;
  INSERT INTO files_fts (rowid, filename, tags, metadata)
  VALUES (
    new.id,
    new.filename,
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
      WHERE ft.file_id = new.id
    ), ''),
    COALESCE(new.metadata_json, '')
  );
END;

-- Metadata gets written by the thumbnail worker after rendering, so this
-- trigger fires once per file post-render.
CREATE TRIGGER IF NOT EXISTS files_fts_after_update_metadata
AFTER UPDATE OF metadata_json ON files
BEGIN
  DELETE FROM files_fts WHERE rowid = old.id;
  INSERT INTO files_fts (rowid, filename, tags, metadata)
  VALUES (
    new.id,
    new.filename,
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
      WHERE ft.file_id = new.id
    ), ''),
    COALESCE(new.metadata_json, '')
  );
END;

-- ─── file_tags lifecycle ────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS files_fts_after_tag_insert
AFTER INSERT ON file_tags
BEGIN
  DELETE FROM files_fts WHERE rowid = new.file_id;
  INSERT INTO files_fts (rowid, filename, tags, metadata)
  SELECT
    f.id,
    f.filename,
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
      WHERE ft.file_id = f.id
    ), ''),
    COALESCE(f.metadata_json, '')
  FROM files f WHERE f.id = new.file_id;
END;

CREATE TRIGGER IF NOT EXISTS files_fts_after_tag_delete
AFTER DELETE ON file_tags
BEGIN
  DELETE FROM files_fts WHERE rowid = old.file_id;
  INSERT INTO files_fts (rowid, filename, tags, metadata)
  SELECT
    f.id,
    f.filename,
    COALESCE((
      SELECT GROUP_CONCAT(t.name, ' ')
      FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
      WHERE ft.file_id = f.id
    ), ''),
    COALESCE(f.metadata_json, '')
  FROM files f WHERE f.id = old.file_id;
END;

-- ─── backfill any pre-existing rows ─────────────────────────────────────

DELETE FROM files_fts;
INSERT INTO files_fts (rowid, filename, tags, metadata)
SELECT
  f.id,
  f.filename,
  COALESCE((
    SELECT GROUP_CONCAT(t.name, ' ')
    FROM file_tags ft JOIN tags t ON t.id = ft.tag_id
    WHERE ft.file_id = f.id
  ), ''),
  COALESCE(f.metadata_json, '')
FROM files f;
