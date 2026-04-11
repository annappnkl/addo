// Web-only drag-and-drop for moving todos between buckets.
// Metro resolves dragDrop.tsx on web, dragDrop.native.tsx on iOS/Android.
import React, { type ReactNode } from 'react';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Bucket } from '../types';

export type MoveFn = (todoId: string, newBucket: Bucket) => Promise<void>;

export function DragProvider({
  children,
  onMove,
}: {
  children: ReactNode;
  onMove: MoveFn;
}) {
  // Require 8px movement before activating drag so normal taps pass through.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const fromBucket = active.data.current?.['bucket'] as Bucket | undefined;
    const toBucket = over.id as Bucket;
    if (!fromBucket || fromBucket === toBucket) return;
    void onMove(active.id as string, toBucket);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}

export function DraggableTodo({
  id,
  bucket,
  children,
}: {
  id: string;
  bucket: Bucket;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { bucket },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.85 : undefined,
    boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.14)' : undefined,
    zIndex: isDragging ? 999 : undefined,
    position: isDragging ? 'relative' : undefined,
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {children}
    </div>
  );
}

export function DroppableBucket({
  bucket,
  children,
}: {
  bucket: Bucket;
  children: (isOver: boolean) => ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: bucket });
  return (
    <div ref={setNodeRef} style={{ width: '100%' }}>
      {children(isOver)}
    </div>
  );
}
