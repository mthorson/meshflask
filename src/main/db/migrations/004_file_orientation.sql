-- Phase 5b: per-file orientation override.
--
-- The model is rotated on load so its "up" axis matches Three.js's world +Y.
-- The default per file format (STL/3MF → +Z up, etc.) is computed in code so
-- it can evolve without a migration. This column stores ONLY user-set
-- overrides; NULL means "use the format default".
--
-- JSON because we may grow this in the future (yaw rotation, custom front
-- axis, etc.) without another schema migration.

ALTER TABLE files ADD COLUMN orientation_json TEXT;
