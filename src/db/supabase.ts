import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in the values.'
  );
}

// Minimal Database type matching the schema in supabase/migrations/20260411000000_initial_schema.sql.
// These types are hand-written — regenerate with `supabase gen types` once a Supabase project exists.
export type Database = {
  public: {
    Tables: {
      areas: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string | null;
          weekly_budget_minutes: number | null;
          created_at: string;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string | null;
          weekly_budget_minutes?: number | null;
        };
        Update: {
          name?: string;
          color?: string | null;
          weekly_budget_minutes?: number | null;
        };
        Relationships: [];
      };
      todos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          estimated_minutes: number;
          bucket: 'Must' | 'Want' | 'Later';
          area_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          estimated_minutes?: number;
          bucket: 'Must' | 'Want' | 'Later';
          area_id?: string | null;
          notes?: string | null;
        };
        Update: {
          title?: string;
          estimated_minutes?: number;
          bucket?: 'Must' | 'Want' | 'Later';
          area_id?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      side_quests: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          duration_minutes: number;
          link: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          duration_minutes?: number;
          link?: string | null;
          notes?: string | null;
        };
        Update: {
          title?: string;
          duration_minutes?: number;
          link?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          area_id: string;
          planned_duration_minutes: number;
          actual_duration_minutes: number | null;
          started_at: string;
          ended_at: string | null;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          area_id: string;
          planned_duration_minutes: number;
          actual_duration_minutes?: number | null;
          started_at: string;
          ended_at?: string | null;
        };
        Update: {
          actual_duration_minutes?: number | null;
          ended_at?: string | null;
        };
        Relationships: [];
      };
      session_rolls: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          todo_id: string | null;
          side_quest_id: string | null;
          outcome: 'done' | 'skipped' | 'side_quest';
          actual_minutes: number | null;
          rolled_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          todo_id?: string | null;
          side_quest_id?: string | null;
          outcome: 'done' | 'skipped' | 'side_quest';
          actual_minutes?: number | null;
          rolled_at?: string;
        };
        Update: {
          outcome?: 'done' | 'skipped' | 'side_quest';
          actual_minutes?: number | null;
        };
        Relationships: [];
      };
      calendar_links: {
        Row: {
          id: string;
          user_id: string;
          area_id: string;
          calendar_id: string;
          calendar_name: string;
          include_all_day: boolean;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          area_id: string;
          calendar_id: string;
          calendar_name: string;
          include_all_day?: boolean;
        };
        Update: {
          calendar_name?: string;
          include_all_day?: boolean;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          id: string;
          user_id: string;
          break_interval_minutes: number;
          side_quest_ratio: number;
          trust_auto_pack: boolean;
          updated_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          break_interval_minutes?: number;
          side_quest_ratio?: number;
          trust_auto_pack?: boolean;
        };
        Update: {
          break_interval_minutes?: number;
          side_quest_ratio?: number;
          trust_auto_pack?: boolean;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          user_id: string;
          accepted_tos_version: number | null;
          accepted_privacy_version: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          accepted_tos_version?: number | null;
          accepted_privacy_version?: number | null;
          updated_at?: string;
        };
        Update: {
          accepted_tos_version?: number | null;
          accepted_privacy_version?: number | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
