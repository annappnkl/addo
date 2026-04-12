-- Make sessions.area_id nullable so sessions can be saved before Areas (Feature 7) is built.
-- When Area is selected in a session (post-F7), area_id will be populated.
-- Sessions without an area (free-form sessions) will remain NULL permanently.

ALTER TABLE sessions ALTER COLUMN area_id DROP NOT NULL;
