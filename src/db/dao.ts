// Web implementation — reads and writes go directly to Supabase.
// No local SQLite layer on web (SharedArrayBuffer unavailable in browsers).
// queueForSync is a no-op: writes are synchronous with the remote DB.
import { supabase } from './supabase';
import type { Todo, Bucket } from '../types';

export async function getTodosByUser(userId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Todo[];
}

export async function insertTodo(
  userId: string,
  title: string,
  estimatedMinutes: number,
  bucket: Bucket,
  areaId: string | null = null,
  notes: string | null = null
): Promise<Todo> {
  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      title,
      estimated_minutes: estimatedMinutes,
      bucket,
      area_id: areaId,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Todo;
}

export async function updateTodo(
  id: string,
  fields: Partial<Pick<Todo, 'title' | 'estimated_minutes' | 'bucket' | 'area_id' | 'notes'>>
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await supabase.from('todos').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}
