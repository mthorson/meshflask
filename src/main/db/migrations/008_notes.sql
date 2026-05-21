-- Phase 7a: free-text notes per file.
--
-- Tags handle short structured labels; notes handle long-form remarks like
-- "needs supports", "scale to 110%", or print-prep instructions. No index —
-- notes are read alongside the file row and aren't filtered on directly.

ALTER TABLE files ADD COLUMN notes TEXT;
