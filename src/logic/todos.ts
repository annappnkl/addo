import type { Todo, Bucket } from '../types';

export function bucketTotalMinutes(todos: Todo[], bucket: Bucket): number {
  return todos
    .filter((t) => t.bucket === bucket)
    .reduce((sum, t) => sum + t.estimated_minutes, 0);
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
