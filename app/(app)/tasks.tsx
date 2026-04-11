import { useEffect, useRef, useState } from 'react';
import {
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
  Alert,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/db/supabase';
import { getTodosByUser, insertTodo, deleteTodo } from '../../src/db/dao';
import { bucketTotalMinutes, formatMinutes } from '../../src/logic/todos';
import type { Bucket, Todo } from '../../src/types';

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

// ─── TaskCard ─────────────────────────────────────────────────────────────────

function TaskCard({ todo, onDelete }: { todo: Todo; onDelete: () => void }) {
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

  if (Platform.OS === 'web') {
    return (
      <HoverableView
        style={styles.cardWeb}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <View style={styles.cardRow}>
          <View style={styles.cardText}>
            <Text style={styles.taskName}>{todo.title}</Text>
            <Text style={styles.taskDuration}>{formatMinutes(todo.estimated_minutes)}</Text>
          </View>
          {hovered && (
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={20} color={C.Destructive} />
            </TouchableOpacity>
          )}
        </View>
      </HoverableView>
    );
  }

  // Native: swipe-left to reveal red delete button
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
        <Text style={styles.taskName}>{todo.title}</Text>
        <Text style={styles.taskDuration}>{formatMinutes(todo.estimated_minutes)}</Text>
      </Animated.View>
    </View>
  );
}

// ─── BucketSection ────────────────────────────────────────────────────────────

function BucketSection({
  bucket,
  todos,
  onDelete,
  isWide,
}: {
  bucket: Bucket;
  todos: Todo[];
  onDelete: (id: string) => void;
  isWide: boolean;
}) {
  const bucketTodos = todos.filter((t) => t.bucket === bucket);

  return (
    <View style={[styles.bucketSection, isWide ? styles.bucketSectionWide : styles.bucketSectionNarrow]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>{bucket}</Text>
        <Text style={styles.sectionTotal}>{formatMinutes(bucketTotalMinutes(todos, bucket))}</Text>
      </View>

      {bucketTodos.length === 0 ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        bucketTodos.map((todo) => (
          <TaskCard
            key={todo.id}
            todo={todo}
            onDelete={() =>
              Alert.alert('Delete task', 'Remove this task from your pool?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(todo.id) },
              ])
            }
          />
        ))
      )}
    </View>
  );
}

// ─── TasksScreen ──────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  const [todos, setTodos] = useState<Todo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<Bucket>('Must');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    await insertTodo(userId, title.trim(), selectedDuration, selectedBucket);
    setTitle('');
    setSelectedDuration(null);
    setSelectedBucket('Must');
    await loadTodos(userId);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await deleteTodo(id);
    if (userId) await loadTodos(userId);
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
            disabled={!canAdd || saving}
            activeOpacity={0.85}
          >
            <Text style={[styles.addButtonText, !canAdd && styles.addButtonTextDisabled]}>
              {saving ? 'Adding…' : 'Add task'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── Bucket sections ───────────────────────────────────────────── */}
        <View style={[styles.bucketsContainer, isWide && styles.bucketsContainerWide]}>
          {BUCKETS.map((bucket) => (
            <BucketSection
              key={bucket}
              bucket={bucket}
              todos={todos}
              onDelete={handleDelete}
              isWide={isWide}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.Bg,
  },
  scrollContent: {
    paddingBottom: 48,
  },

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
  titleInputFocused: {
    borderColor: C.Accent,
  },
  pillsScroll: {
    flexGrow: 0,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: C.SurfaceAlt,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillSelected: {
    backgroundColor: C.AccentLight,
    borderColor: C.Accent,
  },
  pillText: {
    fontSize: 13,
    color: C.TextSecondary,
  },
  pillTextSelected: {
    color: C.Accent,
    fontWeight: '600',
  },
  bucketPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  bucketPill: {
    flex: 1,
    backgroundColor: C.SurfaceAlt,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  bucketPillSelected: {
    backgroundColor: C.AccentLight,
    borderColor: C.Accent,
  },
  bucketPillText: {
    fontSize: 15,
    color: C.TextSecondary,
  },
  bucketPillTextSelected: {
    color: C.Accent,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: C.Accent,
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: C.Border,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: C.TextDisabled,
  },

  divider: {
    height: 1,
    backgroundColor: C.Border,
  },

  // ── Bucket sections
  bucketsContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  bucketsContainerWide: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  bucketSection: {},
  bucketSectionWide: {
    flex: 1,
  },
  bucketSectionNarrow: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    color: C.TextPrimary,
  },
  sectionTotal: {
    fontSize: 13,
    color: C.TextSecondary,
  },
  emptyText: {
    fontSize: 15,
    color: C.TextSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Task cards — web
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
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
    marginRight: 8,
  },

  // ── Task cards — native (swipe-to-delete)
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
  cardNative: {
    backgroundColor: C.Surface,
    borderRadius: 16,
    padding: 16,
  },

  // ── Shared card text
  taskName: {
    fontSize: 17,
    fontWeight: '600',
    color: C.TextPrimary,
    marginBottom: 4,
  },
  taskDuration: {
    fontSize: 13,
    color: C.TextSecondary,
  },
});
