// Web stub — expo-sqlite requires SharedArrayBuffer which is unavailable in
// standard browser environments. On web, all reads/writes go directly to
// Supabase (see dao.ts). These are intentional no-ops.
export function getDb(): never {
  throw new Error('SQLite is not available on web');
}

export function initDb(): void {
  // no-op on web
}
