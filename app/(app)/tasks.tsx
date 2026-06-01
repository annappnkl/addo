import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewProps,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../src/db/supabase';
import { getTodosByUser, insertTodo, deleteTodo, updateTodo, getAreasByUser, getSubgoalsByUser, insertArea, insertSubgoal } from '../../src/db/dao';
import { bucketTotalMinutes, formatMinutes, moveBucketCircular, splitByDuration } from '../../src/logic/todos';
import type { Area, Bucket, Subgoal, Todo } from '../../src/types';
import {
  Colors,
  AddInput,
  Chip,
  FieldInput,
  ItemMeta,
  PreviewChip,
  SectionHeader,
} from '../../src/components/ui';

// ─── Asset icons (paths from assets/*.svg, viewBox matches Material Symbols) ──
function ArrowLeftIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="m559.5-279-201-201 201-201 18 18.5L395-480l182.5 182.5-18 18.5Z" fill={color} />
    </Svg>
  );
}
function ArrowRightIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="M541-480 358.5-662.5l18-18.5 201 201-201 201-18-18.5L541-480Z" fill={color} />
    </Svg>
  );
}
function TrashIcon({ color, size = 24 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="M313.5-177q-23.97 0-40.73-16.77Q256-210.53 256-234.5v-484h-39.5v-25.33H361V-771h238.5v27H744v25.5h-39.5v484.23q0 24.21-16.53 40.74T647-177H313.5ZM679-718.5H281.5v484q0 14 9 23t23 9H647q12 0 22-10t10-22v-484ZM404.5-282H430v-357.5h-25.5V-282Zm126 0H556v-357.5h-25.5V-282Zm-249-436.5v516-516Z" fill={color} />
    </Svg>
  );
}

const DURATION_OPTIONS = [5, 10, 15, 20, 30] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const BUCKETS: Bucket[] = ['Must', 'Want', 'Later'];
const WIDE_BREAKPOINT = 768;

// React Native Web supports onMouseEnter/onMouseLeave on View but they are not
// typed in base @types/react-native. This typed wrapper avoids `any`.
type WebHoverExtras = { onMouseEnter?: () => void; onMouseLeave?: () => void };
const HoverableView = View as React.ComponentType<ViewProps & WebHoverExtras>;

// ─── Edit draft ───────────────────────────────────────────────────────────────
interface EditDraft {
  title: string;
  duration: DurationOption | null;
  bucket: Bucket;
  notes: string;
  areaId: string | null;
  subgoalId: string | null;
}

function draftFromTodo(todo: Todo): EditDraft {
  const matched = (DURATION_OPTIONS as readonly number[]).includes(todo.estimated_minutes)
    ? (todo.estimated_minutes as DurationOption)
    : null;
  return {
    title: todo.title,
    duration: matched,
    bucket: todo.bucket,
    notes: todo.notes ?? '',
    areaId: todo.area_id,
    subgoalId: todo.subgoal_id,
  };
}

// ─── Shared edit form (rendered inside expanded row) ──────────────────────────
function EditForm({
  draft,
  onChange,
  areas,
  subgoals,
  onCreateArea,
  onCreateSubgoal,
}: {
  draft: EditDraft;
  onChange: (d: EditDraft) => void;
  areas: Area[];
  subgoals: Subgoal[];
  onCreateArea: (name: string) => Promise<Area | null>;
  onCreateSubgoal: (name: string, areaId: string) => Promise<Subgoal | null>;
}) {
  const [addingArea, setAddingArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [addingSubgoal, setAddingSubgoal] = useState(false);
  const [newSubgoalName, setNewSubgoalName] = useState('');

  async function submitArea() {
    const name = newAreaName.trim();
    setAddingArea(false);
    setNewAreaName('');
    if (!name) return;
    const area = await onCreateArea(name);
    if (area) onChange({ ...draft, areaId: area.id, subgoalId: null });
  }

  async function submitSubgoal() {
    const name = newSubgoalName.trim();
    setAddingSubgoal(false);
    setNewSubgoalName('');
    if (!name || !draft.areaId) return;
    const sg = await onCreateSubgoal(name, draft.areaId);
    if (sg) onChange({ ...draft, subgoalId: sg.id });
  }

  return (
    <View style={styles.editForm}>
      <View style={styles.editChipsWrap}>
        {DURATION_OPTIONS.map((d) => (
          <PreviewChip
            key={d}
            label={`${d} min`}
            selected={draft.duration === d}
            onPress={() => onChange({ ...draft, duration: d })}
          />
        ))}
      </View>

      <View style={styles.editChipsWrap}>
        <PreviewChip
          label="No area"
          selected={draft.areaId === null}
          onPress={() => onChange({ ...draft, areaId: null, subgoalId: null })}
        />
        {areas.map((area) => (
          <PreviewChip
            key={area.id}
            label={area.name}
            selected={draft.areaId === area.id}
            onPress={() => onChange({ ...draft, areaId: area.id, subgoalId: null })}
          />
        ))}
        {addingArea ? (
          <TextInput
            style={styles.inlineCreateInput}
            value={newAreaName}
            onChangeText={setNewAreaName}
            placeholder="Area name"
            placeholderTextColor={Colors.textDisabled}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitArea}
            onBlur={submitArea}
          />
        ) : (
          <PreviewChip label="+" selected={false} onPress={() => setAddingArea(true)} />
        )}
      </View>

      {draft.areaId && (
        <View style={styles.editChipsWrap}>
          {subgoals.filter((s) => s.area_id === draft.areaId).map((sg) => (
            <PreviewChip
              key={sg.id}
              label={sg.hashtag}
              selected={draft.subgoalId === sg.id}
              onPress={() => onChange({ ...draft, subgoalId: draft.subgoalId === sg.id ? null : sg.id })}
            />
          ))}
          {addingSubgoal ? (
            <TextInput
              style={styles.inlineCreateInput}
              value={newSubgoalName}
              onChangeText={setNewSubgoalName}
              placeholder="Subgoal name"
              placeholderTextColor={Colors.textDisabled}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitSubgoal}
              onBlur={submitSubgoal}
            />
          ) : (
            <PreviewChip label="+" selected={false} onPress={() => setAddingSubgoal(true)} />
          )}
        </View>
      )}

      <FieldInput
        value={draft.notes}
        onChangeText={(v) => onChange({ ...draft, notes: v })}
        placeholder="Add a note, link, or anything else…"
        multiline
        numberOfLines={3}
        style={styles.editNotesInput}
      />
    </View>
  );
}

// ─── TaskMeta — area + subgoal subtitle shown in collapsed row ────────────────
function TaskMeta({ todo, areas, subgoals }: { todo: Todo; areas: Area[]; subgoals: Subgoal[] }) {
  if (!todo.area_id) return null;
  const area = areas.find((a) => a.id === todo.area_id);
  if (!area) return null;
  const sg = todo.subgoal_id ? subgoals.find((s) => s.id === todo.subgoal_id) : null;
  const label = sg ? `${area.name} · ${sg.hashtag}` : area.name;
  return <Text style={styles.taskMeta}>{label}</Text>;
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({
  todo,
  isExpanded,
  draft,
  onTap,
  onComplete,
  onDelete,
  onDraftChange,
  isHovered,
  isSelected,
  onHoverIn,
  onHoverOut,
  onSelect,
  onMoveBucket,
  areas,
  subgoals,
  onCreateArea,
  onCreateSubgoal,
}: {
  todo: Todo;
  isExpanded: boolean;
  draft: EditDraft;
  onTap: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onDraftChange: (d: EditDraft) => void;
  isHovered: boolean;
  isSelected: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onSelect: () => void;
  onMoveBucket: (direction: 'left' | 'right') => void;
  areas: Area[];
  subgoals: Subgoal[];
  onCreateArea: (name: string) => Promise<Area | null>;
  onCreateSubgoal: (name: string, areaId: string) => Promise<Subgoal | null>;
}) {
  const showIcons = (isHovered || isSelected) && !isExpanded;
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isExpanded) return;
    // After autoFocus fires, move cursor to end of existing text.
    requestAnimationFrame(() => {
      const len = draft.title.length;
      if (Platform.OS === 'web') {
        // On web, autoFocus will have made the textarea the active element.
        const el = document.activeElement as HTMLTextAreaElement | null;
        el?.setSelectionRange(len, len);
      } else {
        titleInputRef.current?.setNativeProps({ selection: { start: len, end: len } });
      }
    });
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right-side slot shared by web and native collapsed renders.
  // Duration text and icons occupy the same space; opacity toggles between them.
  const rightSlot = (
    <View style={styles.rightSlot}>
      <View style={{ opacity: showIcons ? 0 : 1 }}>
        <ItemMeta>{formatMinutes(todo.estimated_minutes)}</ItemMeta>
      </View>
      <View style={[styles.iconsRow, { opacity: showIcons ? 1 : 0 }]}>
        <TouchableOpacity
          onPress={onComplete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="check-circle" size={24} color={Colors.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onMoveBucket('left')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeftIcon color={Colors.textSecondary} size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onMoveBucket('right')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowRightIcon color={Colors.textSecondary} size={24} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <TrashIcon color={Colors.destructive} size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const rowStyle = isExpanded
    ? [styles.taskRow, styles.taskRowExpanded]
    : styles.taskRow;

  // ── Web ──────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    if (isExpanded) {
      return (
        <Pressable style={[rowStyle, { cursor: 'default' } as object]} onPress={() => {}}>
          <View style={styles.taskRowHeader}>
            <TextInput
              ref={titleInputRef}
              style={styles.taskNameInput}
              value={draft.title}
              onChangeText={(v) => onDraftChange({ ...draft, title: v })}
              placeholder="Task title"
              placeholderTextColor={Colors.textDisabled}
              multiline
              autoFocus
            />
            <TouchableOpacity onPress={onTap} activeOpacity={0.7}>
              <Feather name="chevron-up" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <EditForm
            draft={draft}
            onChange={onDraftChange}
            areas={areas}
            subgoals={subgoals}
            onCreateArea={onCreateArea}
            onCreateSubgoal={onCreateSubgoal}
          />
        </Pressable>
      );
    }

    return (
      <HoverableView
        style={rowStyle}
        onMouseEnter={onHoverIn}
        onMouseLeave={onHoverOut}
      >
        <TouchableOpacity onPress={onTap} style={styles.taskRowTapArea} activeOpacity={0.8}>
          <Text style={styles.taskName}>{todo.title}</Text>
          <TaskMeta todo={todo} areas={areas} subgoals={subgoals} />
        </TouchableOpacity>
        {rightSlot}
      </HoverableView>
    );
  }

  // ── Native ───────────────────────────────────────────────────────────────────
  if (isExpanded) {
    return (
      <Pressable style={rowStyle} onPress={() => {}}>
        <View style={styles.taskRowHeader}>
          <TextInput
            ref={titleInputRef}
            style={styles.taskNameInput}
            value={draft.title}
            onChangeText={(v) => onDraftChange({ ...draft, title: v })}
            placeholder="Task title"
            placeholderTextColor={Colors.textDisabled}
            multiline
            autoFocus
          />
          <TouchableOpacity onPress={onTap} activeOpacity={0.7}>
            <Feather name="chevron-up" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <EditForm
          draft={draft}
          onChange={onDraftChange}
          areas={areas}
          subgoals={subgoals}
          onCreateArea={onCreateArea}
          onCreateSubgoal={onCreateSubgoal}
        />
      </Pressable>
    );
  }

  return (
    <View style={rowStyle}>
      <TouchableOpacity onPress={onSelect} style={styles.taskRowTapArea} activeOpacity={0.8}>
        <Text style={styles.taskName}>{todo.title}</Text>
        <TaskMeta todo={todo} areas={areas} subgoals={subgoals} />
      </TouchableOpacity>
      {rightSlot}
    </View>
  );
}

// ─── BucketSection ────────────────────────────────────────────────────────────
function BucketSection({
  bucket,
  todos,
  expandedId,
  draft,
  isWide,
  hideHeader,
  onToggle,
  onComplete,
  onDelete,
  onDraftChange,
  hoveredTaskId,
  selectedTaskId,
  onHoverIn,
  onHoverOut,
  onSelect,
  onMoveBucket,
  areas,
  subgoals,
  onCreateArea,
  onCreateSubgoal,
}: {
  bucket: Bucket;
  todos: Todo[];
  expandedId: string | null;
  draft: EditDraft;
  isWide: boolean;
  hideHeader?: boolean;
  onToggle: (todo: Todo) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onDraftChange: (d: EditDraft) => void;
  hoveredTaskId: string | null;
  selectedTaskId: string | null;
  onHoverIn: (id: string) => void;
  onHoverOut: () => void;
  onSelect: (id: string) => void;
  onMoveBucket: (id: string, direction: 'left' | 'right') => void;
  areas: Area[];
  subgoals: Subgoal[];
  onCreateArea: (name: string) => Promise<Area | null>;
  onCreateSubgoal: (name: string, areaId: string) => Promise<Subgoal | null>;
}) {
  const bucketTodos = todos.filter((t) => t.bucket === bucket);

  return (
    <View style={[styles.bucketSection, isWide ? styles.bucketSectionWide : styles.bucketSectionNarrow]}>
      {!hideHeader && (
        <View style={styles.sectionHeader}>
          <SectionHeader label={bucket} />
          <SectionHeader label={formatMinutes(bucketTotalMinutes(todos, bucket))} />
        </View>
      )}

      {bucketTodos.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        bucketTodos.map((todo) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            isExpanded={expandedId === todo.id}
            draft={draft}
            onTap={() => onToggle(todo)}
            onComplete={() => onComplete(todo.id)}
            onDelete={() => onDelete(todo.id)}
            onDraftChange={onDraftChange}
            isHovered={hoveredTaskId === todo.id}
            isSelected={selectedTaskId === todo.id}
            onHoverIn={() => onHoverIn(todo.id)}
            onHoverOut={onHoverOut}
            onSelect={() => onSelect(todo.id)}
            onMoveBucket={(dir) => onMoveBucket(todo.id, dir)}
            areas={areas}
            subgoals={subgoals}
            onCreateArea={onCreateArea}
            onCreateSubgoal={onCreateSubgoal}
          />
        ))
      )}
    </View>
  );
}

// ─── TasksScreen ──────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= WIDE_BREAKPOINT;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [subgoals, setSubgoals] = useState<Subgoal[]>([]);

  // Add form
  const [title, setTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<Bucket>('Must');
  const [adding, setAdding] = useState(false);

  // Add form — area/subgoal tagging
  const [addAreaId, setAddAreaId] = useState<string | null>(null);
  const [addSubgoalId, setAddSubgoalId] = useState<string | null>(null);
  const [addFormAddingArea, setAddFormAddingArea] = useState(false);
  const [addFormNewAreaName, setAddFormNewAreaName] = useState('');
  const [addFormAddingSubgoal, setAddFormAddingSubgoal] = useState(false);
  const [addFormNewSubgoalName, setAddFormNewSubgoalName] = useState('');

  // Inline edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ title: '', duration: null, bucket: 'Must', notes: '', areaId: null, subgoalId: null });
  // Hover/selection state for chevron + delete icons
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Mobile tab state
  const [activeBucket, setActiveBucket] = useState<Bucket>('Must');

  const canAdd = title.trim().length > 0;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        void loadAll(user.id);
      }
    });
  }, []);

  // Reload areas + subgoals when returning from the Areas screen
  useFocusEffect(
    useCallback(() => {
      if (userId) void loadAll(userId);
    }, [userId])
  );

  async function loadAll(uid: string) {
    const [loadedTodos, loadedAreas, loadedSubgoals] = await Promise.all([
      getTodosByUser(uid),
      getAreasByUser(uid),
      getSubgoalsByUser(uid),
    ]);
    setTodos(loadedTodos);
    setAreas(loadedAreas);
    setSubgoals(loadedSubgoals);
  }

  async function loadTodos(uid: string) {
    setTodos(await getTodosByUser(uid));
  }

  async function handleAdd() {
    if (!userId || !canAdd) return;
    const minutes = selectedDuration ?? (parseInt(customDurationInput, 10) || 0);
    setAdding(true);
    if (minutes > 0) {
      const tasks = splitByDuration(title.trim(), selectedBucket, minutes);
      for (const t of tasks) {
        await insertTodo(userId, t.title, t.durationMinutes, t.bucket, addAreaId, addSubgoalId);
      }
    } else {
      await insertTodo(userId, title.trim(), 0, selectedBucket, addAreaId, addSubgoalId);
    }
    setTitle('');
    setSelectedDuration(null);
    setShowCustomDuration(false);
    setCustomDurationInput('');
    // intentionally not resetting selectedBucket — user stays on their chosen bucket
    setAddAreaId(null);
    setAddSubgoalId(null);
    await loadTodos(userId);
    setAdding(false);
  }

  async function handleComplete(id: string) {
    if (expandedId === id) setExpandedId(null);
    if (selectedTaskId === id) setSelectedTaskId(null);
    await updateTodo(id, { completed_at: new Date().toISOString() });
    if (userId) await loadTodos(userId);
  }

  async function handleDelete(id: string) {
    if (expandedId === id) setExpandedId(null);
    if (selectedTaskId === id) setSelectedTaskId(null);
    await deleteTodo(id);
    if (userId) await loadTodos(userId);
  }

  async function handleMoveBucket(id: string, direction: 'left' | 'right') {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;
    const newBucket = moveBucketCircular(todo.bucket, direction);
    await updateTodo(id, { bucket: newBucket });
    setSelectedTaskId(null);
    if (userId) await loadTodos(userId);
  }

  function handleSelect(id: string) {
    setSelectedTaskId((prev) => (prev === id ? null : id));
  }

  function handleToggle(todo: Todo) {
    if (expandedId === todo.id) {
      const id = expandedId;
      const currentDraft = draft;
      setExpandedId(null);
      void saveDraft(id, currentDraft);
    } else {
      if (expandedId) {
        const prevId = expandedId;
        const prevDraft = draft;
        void saveDraft(prevId, prevDraft);
      }
      setExpandedId(todo.id);
      setSelectedTaskId(null);
      setDraft(draftFromTodo(todo));
    }
  }

  async function saveDraft(id: string, draftToSave: EditDraft) {
    if (!id || !draftToSave.title.trim()) return;
    const fields: Partial<Pick<Todo, 'title' | 'estimated_minutes' | 'notes' | 'area_id' | 'subgoal_id'>> = {
      title: draftToSave.title.trim(),
      notes: draftToSave.notes.trim() || null,
      area_id: draftToSave.areaId,
      subgoal_id: draftToSave.subgoalId,
    };
    if (draftToSave.duration !== null) {
      fields.estimated_minutes = draftToSave.duration;
    }
    await updateTodo(id, fields);
    if (userId) await loadTodos(userId);
  }

  async function createAreaInline(name: string): Promise<Area | null> {
    if (!userId) return null;
    const area = await insertArea(userId, name);
    if (userId) await loadAll(userId);
    return area;
  }

  async function createSubgoalInline(name: string, areaId: string): Promise<Subgoal | null> {
    if (!userId) return null;
    const hashtag = '#' + name.replace(/\s+/g, '');
    const sg = await insertSubgoal(userId, areaId, name, hashtag);
    if (userId) await loadAll(userId);
    return sg;
  }

  async function addFormSubmitArea() {
    const name = addFormNewAreaName.trim();
    setAddFormAddingArea(false);
    setAddFormNewAreaName('');
    if (!name || !userId) return;
    const area = await insertArea(userId, name);
    await loadAll(userId);
    if (area) { setAddAreaId(area.id); setAddSubgoalId(null); }
  }

  async function addFormSubmitSubgoal() {
    const name = addFormNewSubgoalName.trim();
    setAddFormAddingSubgoal(false);
    setAddFormNewSubgoalName('');
    if (!name || !addAreaId || !userId) return;
    const hashtag = '#' + name.replace(/\s+/g, '');
    const sg = await insertSubgoal(userId, addAreaId, name, hashtag);
    await loadAll(userId);
    if (sg) setAddSubgoalId(sg.id);
  }

  // Sort todos by area so same-area tasks appear adjacent within each bucket
  const sortedTodos = [...todos].sort((a, b) => {
    const aArea = a.area_id ?? '';
    const bArea = b.area_id ?? '';
    return aArea.localeCompare(bArea);
  });

  // Shared BucketSection props
  const sharedSectionProps = {
    todos: sortedTodos,
    expandedId,
    draft,
    onToggle: handleToggle,
    onComplete: handleComplete,
    onDelete: handleDelete,
    onDraftChange: setDraft,
    hoveredTaskId,
    selectedTaskId,
    onHoverIn: (id: string) => setHoveredTaskId(id),
    onHoverOut: () => setHoveredTaskId(null),
    onSelect: handleSelect,
    onMoveBucket: handleMoveBucket,
    areas,
    subgoals,
    onCreateArea: createAreaInline,
    onCreateSubgoal: createSubgoalInline,
  };

  return (
    <SafeAreaView style={styles.root}>
      <Pressable style={[{ flex: 1 }, Platform.OS === 'web' && { cursor: 'default' } as object]} onPress={() => {
        if (expandedId) {
          const id = expandedId;
          const currentDraft = draft;
          setExpandedId(null);
          void saveDraft(id, currentDraft);
        }
      }}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Add task area ──────────────────────────────────────────────── */}
        <View style={[styles.addArea, isWide ? styles.addAreaWide : styles.addAreaNarrow]}>
          <AddInput
            value={title}
            onChangeText={setTitle}
            onSubmit={handleAdd}
            placeholder="What is there to do?"
            submitting={adding}
          />

          {/* Chips — bucket group + duration group */}
          {isWide ? (
            <View style={styles.chipsRow}>
              <View style={styles.chipsGroup}>
                {BUCKETS.map((b) => (
                  <Chip key={b} label={b} selected={selectedBucket === b} onPress={() => setSelectedBucket(b)} />
                ))}
              </View>
              <View style={styles.chipsGroup}>
                {DURATION_OPTIONS.map((d) => (
                  <Chip
                    key={d}
                    label={`${d}'`}
                    selected={selectedDuration === d}
                    onPress={() => { setSelectedDuration(selectedDuration === d ? null : d); setShowCustomDuration(false); setCustomDurationInput(''); }}
                  />
                ))}
                {showCustomDuration ? (
                  <TextInput style={styles.timeInlineInput} value={customDurationInput} onChangeText={setCustomDurationInput}
                    placeholder="e.g. 45" placeholderTextColor={Colors.textSecondary} keyboardType="numeric" autoFocus />
                ) : (
                  <TouchableOpacity style={styles.typeATimeChip} onPress={() => { setShowCustomDuration(true); setSelectedDuration(null); }} activeOpacity={0.7}>
                    <Text style={styles.typeATimeChipText}>Type a time</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.chipsRowNarrow}>
              {BUCKETS.map((b) => (
                <Chip key={b} label={b} selected={selectedBucket === b} onPress={() => setSelectedBucket(b)} />
              ))}
              {DURATION_OPTIONS.map((d) => (
                <Chip
                  key={d}
                  label={`${d}'`}
                  selected={selectedDuration === d}
                  onPress={() => { setSelectedDuration(selectedDuration === d ? null : d); setShowCustomDuration(false); setCustomDurationInput(''); }}
                />
              ))}
              {showCustomDuration ? (
                <TextInput style={styles.timeInlineInput} value={customDurationInput} onChangeText={setCustomDurationInput}
                  placeholder="e.g. 45" placeholderTextColor={Colors.textSecondary} keyboardType="numeric" autoFocus />
              ) : (
                <TouchableOpacity style={styles.typeATimeChip} onPress={() => { setShowCustomDuration(true); setSelectedDuration(null); }} activeOpacity={0.7}>
                  <Text style={styles.typeATimeChipText}>Type a time</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Area tagging for add form */}
          {isWide ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsGroup}>
              <Chip label="No area" selected={addAreaId === null} onPress={() => { setAddAreaId(null); setAddSubgoalId(null); }} />
              {areas.map((area) => (
                <Chip key={area.id} label={area.name} selected={addAreaId === area.id}
                  onPress={() => { setAddAreaId(area.id); setAddSubgoalId(null); }} />
              ))}
              {addFormAddingArea ? (
                <TextInput
                  style={styles.inlineCreateInput}
                  value={addFormNewAreaName}
                  onChangeText={setAddFormNewAreaName}
                  placeholder="Area name"
                  placeholderTextColor={Colors.textDisabled}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addFormSubmitArea}
                  onBlur={addFormSubmitArea}
                />
              ) : (
                <Chip label="+" selected={false} onPress={() => setAddFormAddingArea(true)} />
              )}
            </ScrollView>
          ) : (
            <View style={styles.chipsWrap}>
              <Chip label="No area" selected={addAreaId === null} onPress={() => { setAddAreaId(null); setAddSubgoalId(null); }} />
              {areas.map((area) => (
                <Chip key={area.id} label={area.name} selected={addAreaId === area.id}
                  onPress={() => { setAddAreaId(area.id); setAddSubgoalId(null); }} />
              ))}
              {addFormAddingArea ? (
                <TextInput
                  style={styles.inlineCreateInput}
                  value={addFormNewAreaName}
                  onChangeText={setAddFormNewAreaName}
                  placeholder="Area name"
                  placeholderTextColor={Colors.textDisabled}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={addFormSubmitArea}
                  onBlur={addFormSubmitArea}
                />
              ) : (
                <Chip label="+" selected={false} onPress={() => setAddFormAddingArea(true)} />
              )}
            </View>
          )}
          {addAreaId && (
            isWide ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsGroup}>
                {subgoals.filter((s) => s.area_id === addAreaId).map((sg) => (
                  <Chip key={sg.id} label={sg.hashtag} selected={addSubgoalId === sg.id}
                    onPress={() => setAddSubgoalId(addSubgoalId === sg.id ? null : sg.id)} />
                ))}
                {addFormAddingSubgoal ? (
                  <TextInput
                    style={styles.inlineCreateInput}
                    value={addFormNewSubgoalName}
                    onChangeText={setAddFormNewSubgoalName}
                    placeholder="Subgoal name"
                    placeholderTextColor={Colors.textDisabled}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={addFormSubmitSubgoal}
                    onBlur={addFormSubmitSubgoal}
                  />
                ) : (
                  <Chip label="+" selected={false} onPress={() => setAddFormAddingSubgoal(true)} />
                )}
              </ScrollView>
            ) : (
              <View style={styles.chipsWrap}>
                {subgoals.filter((s) => s.area_id === addAreaId).map((sg) => (
                  <Chip key={sg.id} label={sg.hashtag} selected={addSubgoalId === sg.id}
                    onPress={() => setAddSubgoalId(addSubgoalId === sg.id ? null : sg.id)} />
                ))}
                {addFormAddingSubgoal ? (
                  <TextInput
                    style={styles.inlineCreateInput}
                    value={addFormNewSubgoalName}
                    onChangeText={setAddFormNewSubgoalName}
                    placeholder="Subgoal name"
                    placeholderTextColor={Colors.textDisabled}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={addFormSubmitSubgoal}
                    onBlur={addFormSubmitSubgoal}
                  />
                ) : (
                  <Chip label="+" selected={false} onPress={() => setAddFormAddingSubgoal(true)} />
                )}
              </View>
            )
          )}
        </View>

        {/* ── Wide: classic divider → three columns ─────────────────────── */}
        {isWide && (
          <>
            <View style={[styles.bucketsContainer, styles.bucketsContainerWide]}>
              {BUCKETS.map((bucket) => (
                <BucketSection
                  key={bucket}
                  bucket={bucket}
                  isWide
                  {...sharedSectionProps}
                />
              ))}
            </View>
          </>
        )}

        {/* ── Narrow: tab bar → single active bucket ────────────────────── */}
        {!isWide && (
          <>
            <View style={styles.tabHeaderRow}>
              {BUCKETS.map((bucket) => (
                <TouchableOpacity
                  key={bucket}
                  style={[styles.tabButton, activeBucket === bucket && styles.tabButtonActive]}
                  onPress={() => setActiveBucket(bucket)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabLabel, activeBucket === bucket && styles.tabLabelActive]}>
                    {bucket}
                  </Text>
                  <Text style={[styles.tabTotal, activeBucket === bucket && styles.tabTotalActive]}>
                    {formatMinutes(bucketTotalMinutes(sortedTodos, bucket))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.tabDivider} />

            <View style={styles.bucketsContainer}>
              <BucketSection
                bucket={activeBucket}
                isWide={false}
                hideHeader
                {...sharedSectionProps}
              />
            </View>
          </>
        )}
      </ScrollView>
      </Pressable>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 48 },

  // ── Add task area
  addArea: {
    paddingTop: 32,
    marginBottom: 40,
    gap: 16,
  },
  addAreaWide: {
    alignSelf: 'center',
    paddingHorizontal: 40,
    maxWidth: 760,
  },
  addAreaNarrow: {
    paddingHorizontal: 16,
    width: '100%',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  chipsRowNarrow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipsGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeATimeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeATimeChipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500' },
  timeInlineInput: {
    minWidth: 72,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.textOn,
    textAlign: 'center',
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  // ── Wide three-column layout
  bucketsContainer: { paddingHorizontal: 16, paddingTop: 0 },
  bucketsContainerWide: { paddingHorizontal: 80, flexDirection: 'row', gap: 26, alignItems: 'flex-start' },
  bucketSection: {},
  bucketSectionWide: { flex: 1 },
  bucketSectionNarrow: {},
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 26,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderHeader,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Mobile tab bar
  tabHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: { borderBottomColor: Colors.accent },
  tabLabel: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  tabLabelActive: { color: Colors.accent },
  tabTotal: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  tabTotalActive: { color: Colors.accent },
  tabDivider: { height: 1, backgroundColor: Colors.borderWarm, marginHorizontal: 20 },

  // ── Flat task rows (both layouts)
  taskRow: {
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
  taskRowExpanded: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  // Single-line header inside an expanded row
  taskRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    paddingTop: 20,
    marginBottom: 12,
    width: '100%',
  },
  // Tap area: fills full row height so entire row is clickable
  taskRowTapArea: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  taskName: { fontSize: 16, fontWeight: '400', color: Colors.taskName },
  taskMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  taskNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: Colors.taskName,
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },

  // Right slot: duration text and icons occupy the same space, opacity-toggled
  rightSlot: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  // Icons absolutely fill rightSlot so they overlay the duration text exactly
  iconsRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Edit form (expands within the row)
  editForm: { gap: 14, width: '100%', paddingTop: 4, paddingBottom: 20 },
  editChipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editNotesInput: { minHeight: 72, textAlignVertical: 'top', fontSize: 13 },

  // ── Inline area/subgoal creation input
  inlineCreateInput: {
    minWidth: 96,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    color: Colors.textOn,
    // @ts-ignore — web-only
    outlineWidth: 0,
  },
});
