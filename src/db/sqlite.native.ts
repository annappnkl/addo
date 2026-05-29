import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('addo.db');
  }
  return db;
}

export function initDb(): void {
  const database = getDb();

  database.execSync(`
    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      estimated_minutes INTEGER NOT NULL DEFAULT 30,
      bucket TEXT NOT NULL CHECK(bucket IN ('Must','Want','Later')),
      area_id TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      subgoal_id TEXT,
      completed_at TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      weekly_budget_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS subgoals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      area_id TEXT NOT NULL,
      name TEXT NOT NULL,
      hashtag TEXT NOT NULL,
      weekly_budget_minutes INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS side_quests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 5,
      link TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL,
      planned_duration_minutes INTEGER NOT NULL,
      actual_duration_minutes INTEGER,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      user_id TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS session_rolls (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      todo_id TEXT,
      side_quest_id TEXT,
      outcome TEXT NOT NULL CHECK(outcome IN ('done','skipped','side_quest')),
      actual_minutes INTEGER,
      rolled_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS calendar_links (
      id TEXT PRIMARY KEY,
      area_id TEXT NOT NULL,
      calendar_id TEXT NOT NULL,
      calendar_name TEXT NOT NULL,
      include_all_day INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      user_id TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      break_interval_minutes INTEGER NOT NULL DEFAULT 50,
      side_quest_ratio REAL NOT NULL DEFAULT 0.3,
      trust_auto_pack INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      accepted_tos_version INTEGER,
      accepted_privacy_version INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('insert','update','delete')),
      queued_at TEXT NOT NULL
    );
  `);

  // Idempotent column additions for existing installs (SQLite has no IF NOT EXISTS on ALTER TABLE).
  try { database.execSync(`ALTER TABLE todos ADD COLUMN completed_at TEXT;`); } catch { /* column already exists */ }
  try { database.execSync(`ALTER TABLE todos ADD COLUMN subgoal_id TEXT;`); } catch { /* column already exists */ }
}
