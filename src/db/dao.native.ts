import * as Crypto from 'expo-crypto';
import { getDb } from './sqlite.native';
import type { Todo, Bucket } from '../types';

// Stub: queues a row for remote sync. Real sync engine built in a later session.
function queueForSync(
  tableName: string,
  rowId: string,
  operation: 'insert' | 'update' | 'delete'
): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO sync_queue (table_name, row_id, operation, queued_at) VALUES (?, ?, ?, ?)`,
    [tableName, rowId, operation, new Date().toISOString()]
  );
}

// --- Todos ---

export async function getTodosByUser(userId: string): Promise<Todo[]> {
  const db = getDb();
  return db.getAllSync<Todo>(
    `SELECT * FROM todos WHERE user_id = ? ORDER BY created_at ASC`,
    [userId]
  );
}

export async function insertTodo(
  userId: string,
  title: string,
  estimatedMinutes: number,
  bucket: Bucket,
  areaId: string | null = null,
  notes: string | null = null
): Promise<Todo> {
  const db = getDb();
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();

  db.runSync(
    `INSERT INTO todos (id, title, estimated_minutes, bucket, area_id, notes, created_at, updated_at, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, title, estimatedMinutes, bucket, areaId, notes, now, now, userId]
  );

  queueForSync('todos', id, 'insert');

  return {
    id,
    title,
    estimated_minutes: estimatedMinutes,
    bucket,
    area_id: areaId,
    notes,
    created_at: now,
    updated_at: now,
    user_id: userId,
    synced_at: null,
  };
}

export async function updateTodo(
  id: string,
  fields: Partial<Pick<Todo, 'title' | 'estimated_minutes' | 'bucket' | 'area_id' | 'notes'>>
): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.title !== undefined) { sets.push('title = ?'); values.push(fields.title); }
  if (fields.estimated_minutes !== undefined) { sets.push('estimated_minutes = ?'); values.push(fields.estimated_minutes); }
  if (fields.bucket !== undefined) { sets.push('bucket = ?'); values.push(fields.bucket); }
  if (fields.area_id !== undefined) { sets.push('area_id = ?'); values.push(fields.area_id); }
  if (fields.notes !== undefined) { sets.push('notes = ?'); values.push(fields.notes); }

  if (sets.length === 0) return;

  sets.push('updated_at = ?');
  values.push(now);
  values.push(id);

  db.runSync(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`, values);
  queueForSync('todos', id, 'update');
}

export async function deleteTodo(id: string): Promise<void> {
  const db = getDb();
  db.runSync(`DELETE FROM todos WHERE id = ?`, [id]);
  queueForSync('todos', id, 'delete');
}
