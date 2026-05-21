-- Phase 5c: Collections — user-named, manually-ordered groups of files.
--
-- Collections exist alongside folders and tags but answer a different need:
-- gathering a sequence of models for a workflow (a 3D-print batch, an export
-- set). They are mutually exclusive with the folder filter in the UI — when a
-- collection is active, the grid shows only that collection's files in their
-- stored order.
--
-- `position` is reserved now so drag-to-reorder can land later without
-- another migration; new additions append with MAX(position) + 1.

CREATE TABLE collections (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE collection_files (
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (collection_id, file_id)
);
CREATE INDEX idx_collection_files_pos ON collection_files(collection_id, position);
