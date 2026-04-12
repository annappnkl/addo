import type { Todo, SideQuest } from '../types';

export interface SessionConfig {
  selectedTodos: Todo[];
  selectedSideQuests: SideQuest[];
  durationMinutes: number;
  breakIntervalMinutes: number;
  justShuffleEverything: boolean;
}

export interface RollRecord {
  item: Todo | SideQuest;
  type: 'todo' | 'side_quest';
  outcome: 'done' | 'skipped' | 'escape';
  estimatedMinutes: number;
  actualMinutes: number;
  startedAt: number;
}

export interface SessionResult {
  config: SessionConfig;
  startedAt: number;
  endedAt: number;
  completedRolls: RollRecord[];
  skippedTodos: Todo[];
}

let _config: SessionConfig | null = null;
let _result: SessionResult | null = null;

export function setSessionConfig(c: SessionConfig): void {
  _config = c;
}

export function getSessionConfig(): SessionConfig | null {
  return _config;
}

export function setSessionResult(r: SessionResult): void {
  _result = r;
}

export function getSessionResult(): SessionResult | null {
  return _result;
}

export function clearSession(): void {
  _config = null;
  _result = null;
}
