import type { Todo, Bucket } from '../types';

const BUCKET_ORDER: Bucket[] = ['Must', 'Want', 'Later'];

export function moveBucketCircular(current: Bucket, direction: 'left' | 'right'): Bucket {
  const idx = BUCKET_ORDER.indexOf(current);
  if (direction === 'left') return BUCKET_ORDER[(idx - 1 + 3) % 3];
  return BUCKET_ORDER[(idx + 1) % 3];
}

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
