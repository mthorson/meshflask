-- Per-file saved camera state (position + target + zoom).
--
-- Captured alongside the user's custom thumbnail in PreviewPane: when the
-- user composes a shot and clicks "capture as thumbnail", we store the
-- orbit-camera state too so reopening the file restarts the preview at the
-- same angle they chose. NULL means "use the default frame-fit camera".
--
-- JSON for the same reason as orientation_json — easy to extend (FOV, roll,
-- pan offsets) without another migration.

ALTER TABLE files ADD COLUMN camera_json TEXT;
