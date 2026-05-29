-- Subgoals: specific goals/habits within an Area, identified by a #hashtag.
-- e.g. Area "Health" → subgoals #Hyrox, #Pilates, #Gym

CREATE TABLE subgoals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id               UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  hashtag               TEXT NOT NULL,
  weekly_budget_minutes INTEGER NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at             TIMESTAMPTZ NULL
);

ALTER TABLE subgoals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subgoals: user owns rows"
  ON subgoals FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_updated_at BEFORE UPDATE ON subgoals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Add subgoal link to todos
ALTER TABLE todos
  ADD COLUMN subgoal_id UUID NULL REFERENCES subgoals(id) ON DELETE SET NULL;
