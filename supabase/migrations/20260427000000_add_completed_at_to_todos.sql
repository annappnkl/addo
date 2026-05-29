-- Allow todos to be marked complete outside a session.
-- completed_at is set when the user ticks off a task in the Task Pool.
-- Completed todos are hidden from the working UI but kept for analytics.

ALTER TABLE todos ADD COLUMN completed_at TIMESTAMPTZ NULL;
