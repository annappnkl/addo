import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Animated,
  PanResponder,
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
import { supabase } from '../../src/db/supabase';
import { getTodosByUser, insertTodo, deleteTodo, updateTodo } from '../../src/db/dao';
import { bucketTotalMinutes, formatMinutes } from '../../src/logic/todos';
import type { Bucket, Todo } from '../../src/types';
import { DragProvider, DraggableTodo, DroppableBucket } from '../../src/components/dragDrop';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  Bg: '#F7F6F3',
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

const DURATION_OPTIONS = [5, 15, 30, 45, 60, 90] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const BUCKETS: Bucket[] = ['Must', 'Want', 'Later'];
const WIDE_BREAKPOINT = 768;
const SWIPE_WIDTH = 72;

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

// ─── Shared edit form (rendered inside expanded card) ─────────────────────────
function EditForm({
  draft,
  isSaving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: EditDraft;
  isSaving: boolean;
  onChange: (d: EditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [titleFocused, setTitleFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const canSave = draft.title.trim().length > 0 && draft.duration !== null;

  return (
    <View style={styles.editForm}>
      <TextInput
        style={[styles.editInput, titleFocused && styles.editInputFocused]}
        value={draft.title}
        onChangeText={(v) => onChange({ ...draft, title: v })}
        placeholder="Task title"
        placeholderTextColor={C.TextDisabled}
        onFocus={() => setTitleFocused(true)}
        onBlur={() => setTitleFocused(false)}
        autoFocus
      />

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

      <View style={styles.bucketPicker}>
        {BUCKETS.map((b) => (
          <TouchableOpacity
            key={b}
            style={[styles.bucketPill, draft.bucket === b && styles.bucketPillSelected]}
            onPress={() => onChange({ ...draft, bucket: b })}
            activeOpacity={0.7}
          >
            <Text style={[styles.bucketPillText, draft.bucket === b && styles.bucketPillTextSelected]}>
              {b}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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

      <View style={styles.editActions}>
        <TouchableOpacity
          style={[styles.editSaveBtn, !canSave && styles.editSaveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving || !canSave}
          activeOpacity={0.85}
        >
          <Text style={[styles.editSaveBtnText, !canSave && styles.editSaveBtnTextDisabled]}>
            {isSaving ? 'Saving…' : 'Save'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.editCancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={styles.editCancelBtnText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({
  todo,
  isExpanded,
  draft,
  isSaving,
  onTap,
  onDelete,
  onDraftChange,
  onSave,
  onLongPress,
}: {
  todo: Todo;
  isExpanded: boolean;
  draft: EditDraft;
  isSaving: boolean;
  onTap: () => void;
  onDelete: () => void;
  onDraftChange: (d: EditDraft) => void;
  onSave: () => void;
  onLongPress?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -SWIPE_WIDTH));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -(SWIPE_WIDTH / 2)) {
          Animated.spring(translateX, { toValue: -SWIPE_WIDTH, useNativeDriver: true }).start();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  // Snap back when expanding so swipe state doesn't persist
  useEffect(() => {
    if (isExpanded) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [isExpanded, translateX]);

  const expandedHeader = (
    <TouchableOpacity onPress={onTap} style={styles.expandedHeader} activeOpacity={0.7}>
      <Text style={styles.taskName} numberOfLines={1}>{todo.title}</Text>
      <Feather name="chevron-up" size={16} color={C.TextSecondary} />
    </TouchableOpacity>
  );

  // ── Web ──────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'web') {
    if (isExpanded) {
      return (
        <View style={styles.cardWeb}>
          {expandedHeader}
          <EditForm
            draft={draft}
            isSaving={isSaving}
            onChange={onDraftChange}
            onSave={onSave}
            onCancel={onTap}
          />
        </View>
      );
    }

    return (
      <HoverableView
        style={styles.cardWeb}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <View style={styles.cardRow}>
          {/* Card content — tapping opens edit */}
          <TouchableOpacity onPress={onTap} style={styles.cardText} activeOpacity={0.8}>
            <Text style={styles.taskName}>{todo.title}</Text>
            <Text style={styles.taskDuration}>{formatMinutes(todo.estimated_minutes)}</Text>
            {todo.notes ? (
              <Text style={styles.taskNotes} numberOfLines={1}>{todo.notes}</Text>
            ) : null}
          </TouchableOpacity>

          {/* Trash icon — always in DOM, revealed via opacity on hover.
              pointerEvents:'none' when invisible so it can't intercept card taps. */}
          <View
            style={[styles.trashWrap, { opacity: hovered ? 1 : 0 }]}
            pointerEvents={hovered ? 'auto' : 'none'}
          >
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={20} color={C.Destructive} />
            </TouchableOpacity>
          </View>
        </View>
      </HoverableView>
    );
  }

  // ── Native ───────────────────────────────────────────────────────────────────
  if (isExpanded) {
    return (
      <View style={[styles.cardNative, styles.cardNativeStandalone]}>
        {expandedHeader}
        <EditForm
          draft={draft}
          isSaving={isSaving}
          onChange={onDraftChange}
          onSave={onSave}
          onCancel={onTap}
        />
      </View>
    );
  }

  return (
    <View style={styles.cardWrapperNative}>
      <View style={styles.deleteReveal}>
        <Pressable onPress={onDelete} style={styles.deleteRevealBtn}>
          <Feather name="trash-2" size={20} color="#fff" />
        </Pressable>
      </View>
      <Animated.View
        style={[styles.cardNative, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onTap}
          onLongPress={onLongPress}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <Text style={styles.taskName}>{todo.title}</Text>
          <Text style={styles.taskDuration}>{formatMinutes(todo.estimated_minutes)}</Text>
          {todo.notes ? (
            <Text style={styles.taskNotes} numberOfLines={1}>{todo.notes}</Text>
          ) : null}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── BucketSection ────────────────────────────────────────────────────────────
function BucketSection({
  bucket,
  todos,
  expandedId,
  draft,
  isSaving,
  isWide,
  onToggle,
  onDelete,
  onDraftChange,
  onSave,
  onLongPress,
}: {
  bucket: Bucket;
  todos: Todo[];
  expandedId: string | null;
  draft: EditDraft;
  isSaving: boolean;
  isWide: boolean;
  onToggle: (todo: Todo) => void;
  onDelete: (id: string) => void;
  onDraftChange: (d: EditDraft) => void;
  onSave: () => void;
  onLongPress: (todo: Todo) => void;
}) {
  const bucketTodos = todos.filter((t) => t.bucket === bucket);

  return (
    <View style={[styles.bucketSection, isWide ? styles.bucketSectionWide : styles.bucketSectionNarrow]}>
      <DroppableBucket bucket={bucket}>
        {(isDragOver) => (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionLabel, isDragOver && styles.sectionLabelDragOver]}>
                {bucket}
              </Text>
              <Text style={styles.sectionTotal}>{formatMinutes(bucketTotalMinutes(todos, bucket))}</Text>
            </View>

            {bucketTodos.length === 0 ? (
              <Text style={styles.emptyText}>Nothing here yet.</Text>
            ) : (
              bucketTodos.map((todo) => (
                <DraggableTodo key={todo.id} id={todo.id} bucket={todo.bucket}>
                  <TaskCard
                    todo={todo}
                    isExpanded={expandedId === todo.id}
                    draft={draft}
                    isSaving={isSaving}
                    onTap={() => onToggle(todo)}
                    onDelete={() => onDelete(todo.id)}
                    onDraftChange={onDraftChange}
                    onSave={onSave}
                    onLongPress={() => onLongPress(todo)}
                  />
                </DraggableTodo>
              ))
            )}
          </>
        )}
      </DroppableBucket>
    </View>
  );
}

// ─── TasksScreen ──────────────────────────────────────────────────────────────
export default function TasksScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Add form
  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<Bucket>('Must');
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ title: '', duration: null, bucket: 'Must', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  const canAdd = title.trim().length > 0 && selectedDuration !== null;

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
    if (!userId || !canAdd || selectedDuration === null) return;
    setAdding(true);
    await insertTodo(userId, title.trim(), selectedDuration, selectedBucket);
    setTitle('');
    setSelectedDuration(null);
    setSelectedBucket('Must');
    await loadTodos(userId);
    setAdding(false);
  }

  async function handleDelete(id: string) {
    // Close edit if this todo was expanded
    if (expandedId === id) setExpandedId(null);
    await deleteTodo(id);
    if (userId) await loadTodos(userId);
  }

  async function handleMove(todoId: string, newBucket: Bucket) {
    await updateTodo(todoId, { bucket: newBucket });
    if (userId) await loadTodos(userId);
  }

  function handleLongPress(todo: Todo) {
    // No-op on expanded cards — user is in edit mode
    if (expandedId === todo.id) return;
    const otherBuckets = BUCKETS.filter((b) => b !== todo.bucket);
    const options = [...otherBuckets.map((b) => `Move to ${b}`), 'Cancel'];
    const cancelIndex = options.length - 1;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (buttonIndex) => {
          if (buttonIndex === cancelIndex) return;
          void handleMove(todo.id, otherBuckets[buttonIndex]);
        }
      );
    } else {
      Alert.alert('Move task', undefined, [
        ...otherBuckets.map((b) => ({
          text: `Move to ${b}`,
          onPress: () => void handleMove(todo.id, b),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  }

  function handleToggle(todo: Todo) {
    if (expandedId === todo.id) {
      // Already expanded — collapse
      setExpandedId(null);
    } else {
      // Expand and populate draft from current todo values
      setExpandedId(todo.id);
      setDraft(draftFromTodo(todo));
    }
  }

  async function handleSave() {
    if (!expandedId || !draft.title.trim() || draft.duration === null) return;
    setEditSaving(true);
    await updateTodo(expandedId, {
      title: draft.title.trim(),
      estimated_minutes: draft.duration,
      bucket: draft.bucket,
      notes: draft.notes.trim() || null,
    });
    setExpandedId(null);
    if (userId) await loadTodos(userId);
    setEditSaving(false);
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Add task area ──────────────────────────────────────────────── */}
        <View style={styles.addArea}>
          <TextInput
            style={[styles.titleInput, titleFocused && styles.titleInputFocused]}
            placeholder="What needs doing?"
            placeholderTextColor={C.TextDisabled}
            value={title}
            onChangeText={setTitle}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            returnKeyType="done"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsRow}
          >
            {DURATION_OPTIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.pill, selectedDuration === d && styles.pillSelected]}
                onPress={() => setSelectedDuration(selectedDuration === d ? null : d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, selectedDuration === d && styles.pillTextSelected]}>
                  {d} min
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.bucketPicker}>
            {BUCKETS.map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.bucketPill, selectedBucket === b && styles.bucketPillSelected]}
                onPress={() => setSelectedBucket(b)}
                activeOpacity={0.7}
              >
                <Text style={[styles.bucketPillText, selectedBucket === b && styles.bucketPillTextSelected]}>
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!canAdd || adding}
            activeOpacity={0.85}
          >
            <Text style={[styles.addButtonText, !canAdd && styles.addButtonTextDisabled]}>
              {adding ? 'Adding…' : 'Add task'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── Bucket sections ───────────────────────────────────────────── */}
        <DragProvider onMove={handleMove}>
          <View style={[styles.bucketsContainer, isWide && styles.bucketsContainerWide]}>
            {BUCKETS.map((bucket) => (
              <BucketSection
                key={bucket}
                bucket={bucket}
                todos={todos}
                expandedId={expandedId}
                draft={draft}
                isSaving={editSaving}
                isWide={isWide}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onDraftChange={setDraft}
                onSave={handleSave}
                onLongPress={handleLongPress}
              />
            ))}
          </View>
        </DragProvider>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.Bg },
  scrollContent: { paddingBottom: 48 },

  // ── Add task area
  addArea: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 12,
  },
  titleInput: {
    backgroundColor: C.Surface,
    borderWidth: 1,
    borderColor: C.Border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: C.TextPrimary,
  },
  titleInputFocused: { borderColor: C.Accent },
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
  bucketPicker: { flexDirection: 'row', gap: 8 },
  bucketPill: {
    flex: 1,
    backgroundColor: C.SurfaceAlt,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bucketPillSelected: { backgroundColor: C.AccentLight, borderColor: C.Accent },
  bucketPillText: { fontSize: 15, color: C.TextSecondary },
  bucketPillTextSelected: { color: C.Accent, fontWeight: '600' },
  addButton: {
    backgroundColor: C.Accent,
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: { backgroundColor: C.Border },
  addButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  addButtonTextDisabled: { color: C.TextDisabled },

  divider: { height: 1, backgroundColor: C.Border },

  // ── Bucket sections
  bucketsContainer: { paddingHorizontal: 20, paddingTop: 20 },
  bucketsContainerWide: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bucketSection: {},
  bucketSectionWide: { flex: 1 },
  bucketSectionNarrow: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: { fontSize: 13, color: C.TextPrimary },
  sectionLabelDragOver: { color: C.Accent },
  sectionTotal: { fontSize: 13, color: C.TextSecondary },
  emptyText: {
    fontSize: 15,
    color: C.TextSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Shared card text
  taskName: { fontSize: 17, fontWeight: '600', color: C.TextPrimary, marginBottom: 4 },
  taskDuration: { fontSize: 13, color: C.TextSecondary },
  taskNotes: { fontSize: 13, color: C.TextSecondary, marginTop: 2 },

  // ── Expanded header (tap to collapse)
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // ── Web cards
  cardWeb: {
    backgroundColor: C.Surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardText: { flex: 1, marginRight: 8 },
  trashWrap: { padding: 4 },

  // ── Native cards
  cardWrapperNative: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: C.Destructive,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  deleteReveal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SWIPE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteRevealBtn: {
    flex: 1,
    width: SWIPE_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardNative: { backgroundColor: C.Surface, borderRadius: 16, padding: 16 },
  // Standalone = expanded native card (not inside swipe wrapper, needs its own shadow + margin)
  cardNativeStandalone: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Edit form (inside expanded card)
  editForm: { gap: 10 },
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
