-- Phase 7b: hierarchical tags.
--
-- `parent_id` lets tags form a tree (Characters > Heroes > Knight). When
-- filtering by a parent tag, the query expands to include all descendants via
-- a recursive CTE — so files tagged "Knight" appear under "Characters"
-- without duplicating rows in `file_tags`.
--
-- Tag names remain globally unique (the existing `tags.name UNIQUE COLLATE
-- NOCASE` constraint stays in place). That means we don't support the same
-- leaf name under two different parents — a deliberate v1 simplification,
-- traded for not having to rebuild the table (which would re-aim every FK
-- pointing at `tags`).

ALTER TABLE tags ADD COLUMN parent_id INTEGER REFERENCES tags(id) ON DELETE SET NULL;
CREATE INDEX idx_tags_parent ON tags(parent_id);
