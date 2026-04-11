// Native pass-through stubs — drag-to-move is not available on native.
// Long press + action sheet (in tasks.tsx) handles bucket moves instead.
// Metro resolves this file on iOS/Android, dragDrop.tsx on web.
import React, { type ReactNode } from 'react';
import type { Bucket } from '../types';

export type MoveFn = (todoId: string, newBucket: Bucket) => Promise<void>;

export function DragProvider({
  children,
}: {
  children: ReactNode;
  onMove: MoveFn;
}) {
  return <>{children}</>;
}

export function DraggableTodo({
  children,
}: {
  id: string;
  bucket: Bucket;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function DroppableBucket({
  children,
}: {
  bucket: Bucket;
  children: (isOver: boolean) => ReactNode;
}) {
  return <>{children(false)}</>;
}
