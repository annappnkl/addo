import { useEffect, useRef, useState } from 'react';
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
import { supabase } from '../../src/db/supabase';
import { getTodosByUser, insertTodo, deleteTodo, updateTodo } from '../../src/db/dao';
import { bucketTotalMinutes, formatMinutes, moveBucketCircular, splitByDuration } from '../../src/logic/todos';
import type { Bucket, Todo } from '../../src/types';

// ─── Asset icons (paths from assets/*.svg, viewBox matches Material Symbols) ──
function ArrowLeftIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="m559.5-279-201-201 201-201 18 18.5L395-480l182.5 182.5-18 18.5Z" fill={color} />
    </Svg>
  );
}
function ArrowRightIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="M541-480 358.5-662.5l18-18.5 201 201-201 201-18-18.5L541-480Z" fill={color} />
    </Svg>
  );
}
function TrashIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="M313.5-177q-23.97 0-40.73-16.77Q256-210.53 256-234.5v-484h-39.5v-25.33H361V-771h238.5v27H744v25.5h-39.5v484.23q0 24.21-16.53 40.74T647-177H313.5ZM679-718.5H281.5v484q0 14 9 23t23 9H647q12 0 22-10t10-22v-484ZM404.5-282H430v-357.5h-25.5V-282Zm126 0H556v-357.5h-25.5V-282Zm-249-436.5v516-516Z" fill={color} />
    </Svg>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  Bg: '#FFFFFF',
  Surface: '#FFFFFF',
  SurfaceAlt: '#F0EEE9',
  TextPrimary: '#1A1A1A',
  TextSecondary: '#6B7280',
  TextDisabled: '#B0AAAA',
  Accent: '#F97316',
  AccentLight: '#FFF0E6',
  Destructive: '#EF4444',
  Border: '#E5E3DE',
} as const;

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
  };
}

// ─── Shared edit form (rendered inside expanded row) ──────────────────────────
function EditForm({
  draft,
  onChange,
}: {
  draft: EditDraft;
  onChange: (d: EditDraft) => void;
}) {
  const [notesFocused, setNotesFocused] = useState(false);

  return (
    <View style={styles.editForm}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pillsRow}
      >
        {DURATION_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.pill, draft.duration === d && styles.pillSelected]}
            onPress={() => onChange({ ...draft, duration: d })}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, draft.duration === d && styles.pillTextSelected]}>
              {d} min
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        style={[styles.editInput, styles.editNotesInput, notesFocused && styles.editInputFocused]}
        value={draft.notes}
        onChangeText={(v) => onChange({ ...draft, notes: v })}
        placeholder="Add a note, link, or anything else…"
        placeholderTextColor={C.TextDisabled}
        multiline
        numberOfLines={3}
        onFocus={() => setNotesFocused(true)}
        onBlur={() => setNotesFocused(false)}
      />
    </View>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({
  todo,
  isExpanded,
  draft,
  onTap,
  onDelete,
  onDraftChange,
  isHovered,
  isSelected,
  onHoverIn,
  onHoverOut,
  onSelect,
  onMoveBucket,
}: {
  todo: Todo;
  isExpanded: boolean;
  draft: EditDraft;
  onTap: () => void;
  onDelete: () => void;
  onDraftChange: (d: EditDraft) => void;
  isHovered: boolean;
  isSelected: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
  onSelect: () => void;
  onMoveBucket: (direction: 'left' | 'right') => void;
}) {
  const showIcons = (isHovered || isSelected) && !isExpanded;
  const titleInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!isExpanded) return;
    // After autoFocus fires, move cursor to end of existing text.
    requestAnimationFrame(() => {
      const len = draft.title.length;
      titleInputRef.current?.setNativeProps({ selection: { start: len, end: len } });
    });
  }, [isExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Right-side slot shared by web and native collapsed renders.
  // Duration text and icons occupy the same space; opacity toggles between them.
  const rightSlot = (
    <View style={styles.rightSlot}>
      <Text style={[styles.taskDuration, { opacity: showIcons ? 0 : 1 }]}>
        {formatMinutes(todo.estimated_minutes)}
      </Text>
      <View style={[styles.iconsRow, { opacity: showIcons ? 1 : 0 }]}>
        <TouchableOpacity
          onPress={() => onMoveBucket('left')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeftIcon color={C.TextSecondary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onMoveBucket('right')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowRightIcon color={C.TextSecondary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <TrashIcon color={C.Destructive} size={16} />
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
              placeholderTextColor={C.TextDisabled}
              multiline
              autoFocus
            />
            <TouchableOpacity onPress={onTap} activeOpacity={0.7}>
              <Feather name="chevron-up" size={16} color={C.TextSecondary} />
            </TouchableOpacity>
          </View>
          <EditForm
            draft={draft}
            onChange={onDraftChange}
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
            style={styles.taskNameInput}
            value={draft.title}
            onChangeText={(v) => onDraftChange({ ...draft, title: v })}
            placeholder="Task title"
            placeholderTextColor={C.TextDisabled}
            multiline
            autoFocus
          />
          <TouchableOpacity onPress={onTap} activeOpacity={0.7}>
            <Feather name="chevron-up" size={16} color={C.TextSecondary} />
          </TouchableOpacity>
        </View>
        <EditForm
          draft={draft}
          onChange={onDraftChange}
        />
      </Pressable>
    );
  }

  return (
    <View style={rowStyle}>
      <TouchableOpacity onPress={onSelect} style={styles.taskRowTapArea} activeOpacity={0.8}>
        <Text style={styles.taskName}>{todo.title}</Text>
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
  onDelete,
  onDraftChange,
  hoveredTaskId,
  selectedTaskId,
  onHoverIn,
  onHoverOut,
  onSelect,
  onMoveBucket,
}: {
  bucket: Bucket;
  todos: Todo[];
  expandedId: string | null;
  draft: EditDraft;
  isWide: boolean;
  hideHeader?: boolean;
  onToggle: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onDraftChange: (d: EditDraft) => void;
  hoveredTaskId: string | null;
  selectedTaskId: string | null;
  onHoverIn: (id: string) => void;
  onHoverOut: () => void;
  onSelect: (id: string) => void;
  onMoveBucket: (id: string, direction: 'left' | 'right') => void;
}) {
  const bucketTodos = todos.filter((t) => t.bucket === bucket);

  return (
    <View style={[styles.bucketSection, isWide ? styles.bucketSectionWide : styles.bucketSectionNarrow]}>
      {!hideHeader && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{bucket}</Text>
          {/* <Text style={styles.sectionTotal}>{formatMinutes(bucketTotalMinutes(todos, bucket))}</Text> */}
        </View>
      )}

      {bucketTodos.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        bucketTodos.map((todo, index) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            isExpanded={expandedId === todo.id}
            draft={draft}
            onTap={() => onToggle(todo)}
            onDelete={() => onDelete(todo.id)}
            onDraftChange={onDraftChange}
            isHovered={hoveredTaskId === todo.id}
            isSelected={selectedTaskId === todo.id}
            onHoverIn={() => onHoverIn(todo.id)}
            onHoverOut={onHoverOut}
            onSelect={() => onSelect(todo.id)}
            onMoveBucket={(dir) => onMoveBucket(todo.id, dir)}
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

  // Add form
  const [title, setTitle] = useState('');
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState('');
  const [selectedBucket, setSelectedBucket] = useState<Bucket>('Must');
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ title: '', duration: null, bucket: 'Must', notes: '' });
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
        void loadTodos(user.id);
      }
    });
  }, []);

  async function loadTodos(uid: string) {
    setTodos(await getTodosByUser(uid));
  }

  async function handleAdd() {
    if (!userId || !canAdd) return;
    const minutes = selectedDuration ?? parseInt(customDurationInput, 10);
    if (!minutes || minutes <= 0) return;
    setAdding(true);
    const tasks = splitByDuration(title.trim(), selectedBucket, minutes);
    for (const t of tasks) {
      await insertTodo(userId, t.title, t.durationMinutes, t.bucket);
    }
    setTitle('');
    setSelectedDuration(null);
    setShowCustomDuration(false);
    setCustomDurationInput('');
    setSelectedBucket('Must');
    await loadTodos(userId);
    setAdding(false);
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
    const fields: Partial<Pick<Todo, 'title' | 'estimated_minutes' | 'notes'>> = {
      title: draftToSave.title.trim(),
      notes: draftToSave.notes.trim() || null,
    };
    if (draftToSave.duration !== null) {
      fields.estimated_minutes = draftToSave.duration;
    }
    await updateTodo(id, fields);
    if (userId) await loadTodos(userId);
  }

  // Shared BucketSection props
  const sharedSectionProps = {
    todos,
    expandedId,
    draft,
    onToggle: handleToggle,
    onDelete: handleDelete,
    onDraftChange: setDraft,
    hoveredTaskId,
    selectedTaskId,
    onHoverIn: (id: string) => setHoveredTaskId(id),
    onHoverOut: () => setHoveredTaskId(null),
    onSelect: handleSelect,
    onMoveBucket: handleMoveBucket,
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
        <View style={styles.addArea}>
          {/* Pill-shaped input + submit button */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.inputBarText}
              placeholder="What is there to do?"
              placeholderTextColor="#64758B"
              value={title}
              onChangeText={setTitle}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />
            <TouchableOpacity
              style={[styles.submitCircle, { opacity: canAdd ? 1 : 0.35 }]}
              onPress={handleAdd}
              disabled={!canAdd || adding}
              activeOpacity={0.85}
            >
              <Feather name="chevron-down" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Chips — bucket group + duration group, container hugs content */}
          <View style={styles.chipsRow}>
            <View style={styles.chipsGroup}>
              {BUCKETS.map((b) => (
                <TouchableOpacity
                  key={b}
                  style={[styles.bucketChip, selectedBucket === b && styles.bucketChipSelected]}
                  onPress={() => setSelectedBucket(b)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bucketChipText, selectedBucket === b && styles.bucketChipTextSelected]}>
                    {b}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chipsGroup}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationChip, selectedDuration === d && styles.durationChipSelected]}
                  onPress={() => {
                    setSelectedDuration(selectedDuration === d ? null : d);
                    setShowCustomDuration(false);
                    setCustomDurationInput('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.durationChipText, selectedDuration === d && styles.durationChipTextSelected]}>
                    {d}'
                  </Text>
                </TouchableOpacity>
              ))}
              {showCustomDuration ? (
                <TextInput
                  style={styles.timeInlineInput}
                  value={customDurationInput}
                  onChangeText={setCustomDurationInput}
                  placeholder="e.g. 45"
                  placeholderTextColor="#64758B"
                  keyboardType="numeric"
                  autoFocus
                />
              ) : (
                <TouchableOpacity
                  style={styles.typeATimeChip}
                  onPress={() => {
                    setShowCustomDuration(true);
                    setSelectedDuration(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.typeATimeChipText}>Type a time</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
                    {formatMinutes(bucketTotalMinutes(todos, bucket))}
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
  root: { flex: 1, backgroundColor: C.Bg },
  scrollContent: { paddingBottom: 48 },

  // ── Add task area
  addArea: {
    alignSelf: 'center',
    paddingHorizontal: 40,
    paddingTop: 32,
    marginBottom: 40,
    gap: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3F3F3',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    height: 43,
    paddingLeft: 24,
    paddingRight: 4,
    paddingVertical: 8,
  },
  inputBarText: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    backgroundColor: 'transparent',
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },
  submitCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  chipsGroup: { flexDirection: 'row', gap: 6 },
  bucketChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  bucketChipSelected: { backgroundColor: '#FFF0E5', borderColor: '#F97316' },
  bucketChipText: { color: '#0F172A', fontSize: 14, fontWeight: '500' },
  bucketChipTextSelected: { color: '#F97316' },
  durationChip: {
    width: 64,
    height: 38,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipSelected: { backgroundColor: '#FFF0E5', borderColor: '#F97316' },
  durationChipText: { color: '#0F172A', fontSize: 14, fontWeight: '500' },
  durationChipTextSelected: { color: '#F97316' },
  typeATimeChip: {
    width: 128,
    height: 38,
    paddingVertical: 8,
    paddingHorizontal: 21,
    backgroundColor: '#F3F3F3',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeATimeChipText: { color: '#64758B', fontSize: 14, fontWeight: '500' },
  timeInlineInput: {
    width: 128,
    height: 38,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#F97316',
    backgroundColor: '#FFF0E5',
    paddingHorizontal: 21,
    fontSize: 14,
    color: '#0F172A',
    textAlign: 'center',
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },
  pillsScroll: { flexGrow: 0 },
  pillsRow: { flexDirection: 'row', gap: 8 },
  pill: {
    backgroundColor: C.SurfaceAlt,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillSelected: { backgroundColor: C.AccentLight, borderColor: C.Accent },
  pillText: { fontSize: 13, color: C.TextSecondary },
  pillTextSelected: { color: C.Accent, fontWeight: '600' },
  divider: { height: 1, backgroundColor: C.Border },

  // ── Wide three-column layout
  bucketsContainer: { paddingHorizontal: 80, paddingTop: 0 },
  bucketsContainerWide: { flexDirection: 'row', gap: 26, alignItems: 'flex-start' },
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
    borderBottomColor: '#D8D8D8',
  },
  sectionLabel: { color: '#8C8C8C', fontSize: 14, fontWeight: '500' },
  sectionTotal: { color: '#8C8C8C', fontSize: 14, fontWeight: '500' },
  emptyText: {
    fontSize: 15,
    color: C.TextSecondary,
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
  tabButtonActive: { borderBottomColor: C.Accent },
  tabLabel: { fontSize: 15, fontWeight: '600', color: C.TextSecondary },
  tabLabelActive: { color: C.Accent },
  tabTotal: { fontSize: 13, color: C.TextSecondary, marginTop: 2 },
  tabTotalActive: { color: C.Accent },
  tabDivider: { height: 1, backgroundColor: C.Border, marginHorizontal: 20 },

  // ── Flat task rows (both layouts)
  taskRow: {
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E6E6E6',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  taskName: { flex: 1, fontSize: 16, fontWeight: '400', color: '#000000' },
  taskNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },
  taskDuration: { fontSize: 12, fontWeight: '300', color: '#8C8C8C' },

  // Right slot: duration text and icons occupy the same space, opacity-toggled
  rightSlot: {
    width: 80,
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
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Edit form (expands within the row)
  editForm: { gap: 10, width: '100%', paddingTop: 4, paddingBottom: 20 },
  editInput: {
    backgroundColor: C.Surface,
    borderWidth: 1,
    borderColor: C.Border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: C.TextPrimary,
  },
  editInputFocused: { borderColor: C.Accent },
  editNotesInput: { minHeight: 72, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editSaveBtn: {
    flex: 1,
    backgroundColor: C.Accent,
    borderRadius: 28,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSaveBtnDisabled: { backgroundColor: C.Border },
  editSaveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  editSaveBtnTextDisabled: { color: C.TextDisabled },
  editCancelBtn: {
    flex: 1,
    backgroundColor: C.SurfaceAlt,
    borderRadius: 28,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelBtnText: { color: C.TextPrimary, fontSize: 15, fontWeight: '600' },
});
