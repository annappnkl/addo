export type Bucket = 'Must' | 'Want' | 'Later';

export interface Todo {
  id: string;
  title: string;
  estimated_minutes: number;
  bucket: Bucket;
  area_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  completed_at: string | null;
  synced_at: string | null;
}

export interface Area {
  id: string;
  name: string;
  color: string | null;
  weekly_budget_minutes: number | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  synced_at: string | null;
}

export interface SideQuest {
  id: string;
  title: string;
  duration_minutes: number;
  link: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  synced_at: string | null;
}

export interface Session {
  id: string;
  area_id: string;
  planned_duration_minutes: number;
  actual_duration_minutes: number | null;
  started_at: string;
  ended_at: string | null;
  user_id: string;
  synced_at: string | null;
}

export interface SessionRoll {
  id: string;
  session_id: string;
  todo_id: string | null;
  side_quest_id: string | null;
  outcome: 'done' | 'skipped' | 'side_quest';
  actual_minutes: number | null;
  rolled_at: string;
  user_id: string;
  synced_at: string | null;
}

export interface CalendarLink {
  id: string;
  area_id: string;
  calendar_id: string;
  calendar_name: string;
  include_all_day: boolean;
  created_at: string;
  user_id: string;
  synced_at: string | null;
}

export interface Settings {
  id: string;
  user_id: string;
  break_interval_minutes: number;
  side_quest_ratio: number;
  trust_auto_pack: boolean;
  updated_at: string;
  synced_at: string | null;
}

export interface UserProfile {
  id: string;
  user_id: string;
  accepted_tos_version: number | null;
  accepted_privacy_version: number | null;
  updated_at: string;
}
