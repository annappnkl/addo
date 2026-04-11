-- ADDo initial schema — all tables + RLS in one migration.
-- Every table has Row-Level Security enforced at the DB level.
-- user_id = auth.uid() on every policy: even a bug in app code cannot
-- leak one user's data to another user.

-- ─── Enable pgcrypto for gen_random_uuid() ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── areas ──────────────────────────────────────────────────────────────────
CREATE TABLE areas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  color                 TEXT,
  weekly_budget_minutes INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at             TIMESTAMPTZ
);

ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "areas: user owns rows"
  ON areas FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── todos ───────────────────────────────────────────────────────────────────
CREATE TABLE todos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,
  estimated_minutes   INTEGER NOT NULL DEFAULT 30 CHECK (estimated_minutes >= 1),
  bucket              TEXT NOT NULL CHECK (bucket IN ('Must', 'Want', 'Later')),
  area_id             UUID REFERENCES areas(id) ON DELETE SET NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at           TIMESTAMPTZ
);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos: user owns rows"
  ON todos FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── side_quests ─────────────────────────────────────────────────────────────
CREATE TABLE side_quests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 5 CHECK (duration_minutes >= 1),
  link              TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at         TIMESTAMPTZ
);

ALTER TABLE side_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "side_quests: user owns rows"
  ON side_quests FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── sessions ────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id                  UUID NOT NULL REFERENCES areas(id) ON DELETE RESTRICT,
  planned_duration_minutes INTEGER NOT NULL CHECK (planned_duration_minutes >= 1),
  actual_duration_minutes  INTEGER,
  started_at               TIMESTAMPTZ NOT NULL,
  ended_at                 TIMESTAMPTZ,
  synced_at                TIMESTAMPTZ
);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: user owns rows"
  ON sessions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── session_rolls ───────────────────────────────────────────────────────────
-- A roll is one card dealt during a session.
-- Either todo_id or side_quest_id is set, never both, never neither.
CREATE TABLE session_rolls (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  todo_id       UUID REFERENCES todos(id) ON DELETE SET NULL,
  side_quest_id UUID REFERENCES side_quests(id) ON DELETE SET NULL,
  outcome       TEXT NOT NULL CHECK (outcome IN ('done', 'skipped', 'side_quest')),
  actual_minutes INTEGER,
  rolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at     TIMESTAMPTZ,
  CONSTRAINT roll_has_exactly_one_item CHECK (
    (todo_id IS NOT NULL AND side_quest_id IS NULL) OR
    (todo_id IS NULL AND side_quest_id IS NOT NULL)
  )
);

ALTER TABLE session_rolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_rolls: user owns rows"
  ON session_rolls FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── calendar_links ──────────────────────────────────────────────────────────
CREATE TABLE calendar_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id         UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  calendar_id     TEXT NOT NULL,
  calendar_name   TEXT NOT NULL,
  include_all_day BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at       TIMESTAMPTZ
);

ALTER TABLE calendar_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_links: user owns rows"
  ON calendar_links FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── settings ────────────────────────────────────────────────────────────────
CREATE TABLE settings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  break_interval_minutes  INTEGER NOT NULL DEFAULT 50 CHECK (break_interval_minutes >= 1),
  side_quest_ratio        NUMERIC(3,2) NOT NULL DEFAULT 0.30 CHECK (side_quest_ratio BETWEEN 0 AND 1),
  trust_auto_pack         BOOLEAN NOT NULL DEFAULT false,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at               TIMESTAMPTZ
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings: user owns rows"
  ON settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── user_profiles ───────────────────────────────────────────────────────────
-- Stores legal consent versions. Not secret data, but still scoped per user.
CREATE TABLE user_profiles (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_tos_version      INTEGER,
  accepted_privacy_version  INTEGER,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_profiles: user owns rows"
  ON user_profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON areas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON side_quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
