-- Completion notes: optional free-text note captured when a user taps Done
-- on a roulette task. Kept for analytics and Obsidian sync (future).

ALTER TABLE session_rolls ADD COLUMN note TEXT NULL;
