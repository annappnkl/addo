// Web implementation — reads and writes go directly to Supabase.
// No local SQLite layer on web (SharedArrayBuffer unavailable in browsers).
// queueForSync is a no-op: writes are synchronous with the remote DB.
import { supabase } from './supabase';
import type { Todo, Bucket, Area, Subgoal, SideQuest, Session, SessionRoll } from '../types';

export async function getTodosByUser(userId: string): Promise<Todo[]> {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', userId)
    .is('completed_at', null)
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
  fields: Partial<Pick<Todo, 'title' | 'estimated_minutes' | 'bucket' | 'area_id' | 'subgoal_id' | 'notes' | 'completed_at'>>
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await supabase.from('todos').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteTodo(id: string): Promise<void> {
  const { error } = await supabase.from('todos').delete().eq('id', id);
  if (error) throw error;
}

// --- Areas ---

export async function getAreasByUser(userId: string): Promise<Area[]> {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Area[];
}

export async function insertArea(
  userId: string,
  name: string,
  weeklyBudgetMinutes: number | null = null
): Promise<Area> {
  const { data, error } = await supabase
    .from('areas')
    .insert({ user_id: userId, name, weekly_budget_minutes: weeklyBudgetMinutes })
    .select()
    .single();

  if (error) throw error;
  return data as Area;
}

export async function updateArea(
  id: string,
  fields: Partial<Pick<Area, 'name' | 'weekly_budget_minutes'>>
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await supabase.from('areas').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteArea(id: string): Promise<void> {
  const { error } = await supabase.from('areas').delete().eq('id', id);
  if (error) throw error;
}

// --- Subgoals ---

export async function getSubgoalsByUser(userId: string): Promise<Subgoal[]> {
  const { data, error } = await supabase
    .from('subgoals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Subgoal[];
}

export async function getSubgoalsByArea(areaId: string): Promise<Subgoal[]> {
  const { data, error } = await supabase
    .from('subgoals')
    .select('*')
    .eq('area_id', areaId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Subgoal[];
}

export async function insertSubgoal(
  userId: string,
  areaId: string,
  name: string,
  hashtag: string,
  weeklyBudgetMinutes: number | null = null
): Promise<Subgoal> {
  const { data, error } = await supabase
    .from('subgoals')
    .insert({ user_id: userId, area_id: areaId, name, hashtag, weekly_budget_minutes: weeklyBudgetMinutes })
    .select()
    .single();

  if (error) throw error;
  return data as Subgoal;
}

export async function updateSubgoal(
  id: string,
  fields: Partial<Pick<Subgoal, 'name' | 'hashtag' | 'weekly_budget_minutes'>>
): Promise<void> {
  if (Object.keys(fields).length === 0) return;
  const { error } = await supabase.from('subgoals').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteSubgoal(id: string): Promise<void> {
  const { error } = await supabase.from('subgoals').delete().eq('id', id);
  if (error) throw error;
}

// --- Side Quests ---

export async function getSideQuestsByUser(userId: string): Promise<SideQuest[]> {
  const { data, error } = await supabase
    .from('side_quests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as SideQuest[];
}

export async function insertSideQuest(
  sq: Omit<SideQuest, 'id' | 'created_at'>
): Promise<SideQuest> {
  const { data, error } = await supabase
    .from('side_quests')
    .insert({
      user_id: sq.user_id,
      title: sq.title,
      duration_minutes: sq.duration_minutes,
      link: sq.link,
      notes: sq.notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SideQuest;
}

export async function updateSideQuest(
  id: string,
  updates: Partial<SideQuest>
): Promise<SideQuest> {
  const { data, error } = await supabase
    .from('side_quests')
    .update({
      title: updates.title,
      duration_minutes: updates.duration_minutes,
      link: updates.link,
      notes: updates.notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as SideQuest;
}

export async function deleteSideQuest(id: string): Promise<void> {
  const { error } = await supabase.from('side_quests').delete().eq('id', id);
  if (error) throw error;
}

// --- Sessions ---

export async function insertSession(
  s: Omit<Session, 'id'>
): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: s.user_id,
      area_id: s.area_id,
      planned_duration_minutes: s.planned_duration_minutes,
      actual_duration_minutes: s.actual_duration_minutes,
      started_at: s.started_at,
      ended_at: s.ended_at,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Session;
}

export async function insertSessionRoll(
  r: Omit<SessionRoll, 'id'>
): Promise<SessionRoll> {
  const { data, error } = await supabase
    .from('session_rolls')
    .insert({
      user_id: r.user_id,
      session_id: r.session_id,
      todo_id: r.todo_id,
      side_quest_id: r.side_quest_id,
      outcome: r.outcome,
      actual_minutes: r.actual_minutes,
      rolled_at: r.rolled_at,
      note: r.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as SessionRoll;
}

export async function getSessionsByUser(
  userId: string,
  limit = 20
): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Session[];
}
