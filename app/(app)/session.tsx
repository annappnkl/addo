import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/db/supabase';
import { getTodosByUser } from '../../src/db/dao';
import { formatMinutes } from '../../src/logic/todos';
import { setSessionConfig } from '../../src/logic/sessionStore';
import type { Bucket, SideQuest, Todo } from '../../src/types';

// getSideQuestsByUser is not yet in the DAO — another agent owns that file.
// We check for it at runtime and degrade gracefully if absent.
type GetSideQuestsFn = (userId: string) => Promise<{ id: string; title: string; duration_minutes: number }[]>;

function resolveSideQuestsFn(): GetSideQuestsFn | undefined {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const dao = require('../../src/db/dao') as Record<string, unknown>;
  const fn = dao['getSideQuestsByUser'];
  return typeof fn === 'function' ? (fn as GetSideQuestsFn) : undefined;
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
  AccentDark: '#EA6C0A',
  Destructive: '#EF4444',
  Border: '#E5E3DE',
} as const;

// ─── Duration options (in minutes) ───────────────────────────────────────────
const DURATION_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
];

const INTERVAL_OPTIONS: { label: string; minutes: number }[] = [
  { label: '25m', minutes: 25 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '50m', minutes: 50 },
  { label: '60m', minutes: 60 },
];

const DEFAULT_INTERVAL_MINUTES = 50;

const BUCKETS: Bucket[] = ['Must', 'Want', 'Later'];

// ─── Step 1 — Configure ───────────────────────────────────────────────────────
function ConfigureStep({
  durationMinutes,
  intervalMinutes,
  shuffleAll,
  onDurationChange,
  onIntervalChange,
  onShuffleAllChange,
  onContinue,
}: {
  durationMinutes: number | null;
  intervalMinutes: number;
  shuffleAll: boolean;
  onDurationChange: (m: number) => void;
  onIntervalChange: (m: number) => void;
  onShuffleAllChange: (v: boolean) => void;
  onContinue: () => void;
}) {
  const canContinue = durationMinutes !== null;
  const buttonLabel = shuffleAll && canContinue ? 'Start Shuffle \u2192' : 'Continue \u2192';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Calendar coming soon card ──────────────────────────────────── */}
      <View style={styles.comingSoonCard}>
        <Text style={styles.comingSoonText}>
          {'\uD83D\uDCC5'} Calendar connection coming soon
        </Text>
      </View>

      {/* ── How long? ─────────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>How long?</Text>
        <View style={styles.pillsRow}>
          {DURATION_OPTIONS.map((opt) => {
            const selected = durationMinutes === opt.minutes;
            return (
              <TouchableOpacity
                key={opt.minutes}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => onDurationChange(opt.minutes)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Break every ───────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Break every</Text>
        <View style={styles.pillsRow}>
          {INTERVAL_OPTIONS.map((opt) => {
            const selected = intervalMinutes === opt.minutes;
            return (
              <TouchableOpacity
                key={opt.minutes}
                style={[styles.pill, selected && styles.pillSelected]}
                onPress={() => onIntervalChange(opt.minutes)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Just shuffle everything toggle ────────────────────────────── */}
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.toggleTitle}>Just shuffle everything</Text>
          <Text style={styles.toggleSubtitle}>Skip the picker, shuffle all todos randomly</Text>
        </View>
        <Switch
          value={shuffleAll}
          onValueChange={onShuffleAllChange}
          trackColor={{ false: C.Border, true: C.Accent }}
          thumbColor={C.Surface}
        />
      </View>

      {/* ── Continue button ───────────────────────────────────────────── */}
      <TouchableOpacity
        style={[styles.primaryBtn, !canContinue && styles.primaryBtnDisabled]}
        onPress={onContinue}
        disabled={!canContinue}
        activeOpacity={0.85}
      >
        <Text style={[styles.primaryBtnText, !canContinue && styles.primaryBtnTextDisabled]}>
          {buttonLabel}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Todo row (Step 2) ────────────────────────────────────────────────────────
function TodoRow({
  todo,
  selected,
  onToggle,
}: {
  todo: Todo;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.todoRow} onPress={onToggle} activeOpacity={0.75}>
      <Feather
        name={selected ? 'check-square' : 'square'}
        size={20}
        color={selected ? C.Accent : C.TextSecondary}
        style={styles.todoCheckbox}
      />
      <Text style={styles.todoName} numberOfLines={2}>
        {todo.title}
      </Text>
      <Text style={styles.todoDuration}>{formatMinutes(todo.estimated_minutes)}</Text>
    </TouchableOpacity>
  );
}

// ─── Step 2 — This Session picker ────────────────────────────────────────────
function PickerStep({
  durationMinutes,
  intervalMinutes,
  todos,
  selectedIds,
  sideQuestsAvailable,
  onToggle,
  onBack,
  onStart,
}: {
  durationMinutes: number;
  intervalMinutes: number;
  todos: Todo[];
  selectedIds: Set<string>;
  sideQuestsAvailable: boolean;
  onToggle: (id: string) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const trackWidth = screenWidth - 40; // screen minus horizontal padding
  const selectedTodos = todos.filter((t) => selectedIds.has(t.id));
  const selectedMinutes = selectedTodos.reduce((sum, t) => sum + t.estimated_minutes, 0);
  const overBudget = selectedMinutes > durationMinutes;
  const progressRatio = Math.min(selectedMinutes / durationMinutes, 1);
  const hasSelection = selectedIds.size > 0;

  const durationLabel = formatMinutes(durationMinutes);
  const intervalLabel = formatMinutes(intervalMinutes);

  return (
    <SafeAreaView style={styles.root}>
      {/* ── Header row ──────────────────────────────────────────────── */}
      <View style={styles.pickerHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="chevron-left" size={24} color={C.Accent} />
        </TouchableOpacity>
        <Text style={styles.pickerHeaderCaption}>
          Session · {durationLabel} · break every {intervalLabel}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* ── Progress bar ────────────────────────────────────────────── */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: Math.round(progressRatio * trackWidth) },
              overBudget && styles.progressFillOver,
            ]}
          />
        </View>
        <Text style={[styles.progressLabel, overBudget && styles.progressLabelOver]}>
          {formatMinutes(selectedMinutes)} selected of {formatMinutes(durationMinutes)} available
        </Text>
      </View>

      <ScrollView
        style={styles.pickerScroll}
        contentContainerStyle={styles.pickerScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Bucket sections ───────────────────────────────────────── */}
        {BUCKETS.map((bucket) => {
          const bucketTodos = todos.filter((t) => t.bucket === bucket);
          return (
            <View key={bucket} style={styles.bucketSection}>
              <Text style={styles.bucketLabel}>{bucket}</Text>
              {bucketTodos.length === 0 ? (
                <Text style={styles.emptyText}>Nothing here yet.</Text>
              ) : (
                bucketTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    selected={selectedIds.has(todo.id)}
                    onToggle={() => onToggle(todo.id)}
                  />
                ))
              )}
            </View>
          );
        })}

        {/* ── Side Quests section ───────────────────────────────────── */}
        <View style={styles.bucketSection}>
          <Text style={styles.bucketLabel}>Side Quests {'\uD83C\uDFB2'}</Text>
          {sideQuestsAvailable ? null : (
            <Text style={styles.captionSecondary}>Side quests coming soon</Text>
          )}
        </View>
      </ScrollView>

      {/* ── Start button ────────────────────────────────────────────── */}
      <View style={styles.startBtnWrap}>
        <TouchableOpacity
          style={[styles.primaryBtn, !hasSelection && styles.primaryBtnDisabled]}
          onPress={onStart}
          disabled={!hasSelection}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, !hasSelection && styles.primaryBtnTextDisabled]}>
            Start Shuffle {'\u2192'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── SessionScreen ────────────────────────────────────────────────────────────
export default function SessionScreen() {
  // ── Step state
  const [step, setStep] = useState<'configure' | 'picker'>('configure');

  // ── Step 1 state
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [intervalMinutes, setIntervalMinutes] = useState(DEFAULT_INTERVAL_MINUTES);
  const [shuffleAll, setShuffleAll] = useState(false);

  // ── Step 2 state
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sideQuestsAvailable, setSideQuestsAvailable] = useState(false);
  const [sideQuests, setSideQuests] = useState<SideQuest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  // ── Auto-preselect on mount when todos load for the picker
  function autoPreselect(loadedTodos: Todo[], budgetMinutes: number) {
    const selected = new Set<string>();
    let remaining = budgetMinutes;

    // Musts first — greedy fill
    for (const todo of loadedTodos.filter((t) => t.bucket === 'Must')) {
      if (todo.estimated_minutes <= remaining) {
        selected.add(todo.id);
        remaining -= todo.estimated_minutes;
      }
    }

    // Then Wants with remaining time
    for (const todo of loadedTodos.filter((t) => t.bucket === 'Want')) {
      if (todo.estimated_minutes <= remaining) {
        selected.add(todo.id);
        remaining -= todo.estimated_minutes;
      }
    }

    // Later is never auto-selected
    setSelectedIds(selected);
  }

  async function loadTodosAndSideQuests(uid: string, budgetMinutes: number) {
    const loadedTodos = await getTodosByUser(uid);
    setTodos(loadedTodos);
    autoPreselect(loadedTodos, budgetMinutes);

    // Speculatively call getSideQuestsByUser — may not exist yet (another agent owns DAO)
    const sideQuestsFn = resolveSideQuestsFn();
    if (sideQuestsFn) {
      try {
        const loaded = await sideQuestsFn(uid);
        setSideQuests(loaded as SideQuest[]);
        setSideQuestsAvailable(true);
      } catch {
        setSideQuestsAvailable(false);
      }
    }
  }

  function handleContinue() {
    if (durationMinutes === null) return;

    if (shuffleAll) {
      // Skip picker — start immediately with all todos
      setSessionConfig({
        selectedTodos: todos,
        selectedSideQuests: sideQuests,
        durationMinutes,
        breakIntervalMinutes: intervalMinutes,
        justShuffleEverything: true,
      });
      router.push('/(app)/roulette');
      return;
    }

    // Load todos and transition to picker
    if (userId) void loadTodosAndSideQuests(userId, durationMinutes);
    setStep('picker');
  }

  function handleToggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleStart() {
    if (durationMinutes === null) return;
    const selected = todos.filter((t) => selectedIds.has(t.id));
    setSessionConfig({
      selectedTodos: selected,
      selectedSideQuests: sideQuests,
      durationMinutes,
      breakIntervalMinutes: intervalMinutes,
      justShuffleEverything: false,
    });
    router.push('/(app)/roulette');
  }

  if (step === 'picker' && durationMinutes !== null) {
    return (
      <PickerStep
        durationMinutes={durationMinutes}
        intervalMinutes={intervalMinutes}
        todos={todos}
        selectedIds={selectedIds}
        sideQuestsAvailable={sideQuestsAvailable}
        onToggle={handleToggle}
        onBack={() => setStep('configure')}
        onStart={handleStart}
      />
    );
  }

  return (
    <ConfigureStep
      durationMinutes={durationMinutes}
      intervalMinutes={intervalMinutes}
      shuffleAll={shuffleAll}
      onDurationChange={setDurationMinutes}
      onIntervalChange={setIntervalMinutes}
      onShuffleAllChange={setShuffleAll}
      onContinue={handleContinue}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.Bg },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // ── Calendar coming soon card
  comingSoonCard: {
    backgroundColor: C.Surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    opacity: 0.6,
  },
  comingSoonText: {
    fontSize: 13,
    color: C.TextSecondary,
  },

  // ── Sections
  section: { gap: 12 },
  sectionLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: C.TextPrimary,
  },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillSelected: { backgroundColor: '#FFF0E5', borderColor: '#F97316' },
  pillText: { fontSize: 14, color: '#0F172A', fontWeight: '500' },
  pillTextSelected: { fontSize: 14, color: '#F97316', fontWeight: '500' },

  // ── Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.Surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  toggleText: { flex: 1, gap: 4 },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: C.TextPrimary },
  toggleSubtitle: { fontSize: 13, color: C.TextSecondary },

  // ── Buttons
  primaryBtn: {
    backgroundColor: C.Accent,
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: { backgroundColor: C.Border },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  primaryBtnTextDisabled: { color: C.TextDisabled },

  // ── Step 2 — Picker header
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  pickerHeaderCaption: {
    fontSize: 13,
    color: C.TextSecondary,
    flex: 1,
    textAlign: 'center',
  },

  // ── Progress bar
  progressWrap: { paddingHorizontal: 20, gap: 6, marginBottom: 8 },
  progressTrack: {
    height: 4,
    backgroundColor: C.Border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: C.Accent,
    borderRadius: 2,
  },
  progressFillOver: { backgroundColor: C.Destructive },
  progressLabel: { fontSize: 13, color: C.TextSecondary },
  progressLabelOver: { color: C.Destructive },

  // ── Picker scroll
  pickerScroll: { flex: 1 },
  pickerScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 24,
  },

  // ── Bucket sections
  bucketSection: { gap: 8 },
  bucketLabel: {
    fontSize: 14,
    color: '#8C8C8C',
    fontWeight: '500',
  },
  emptyText: { fontSize: 15, color: C.TextSecondary },
  captionSecondary: { fontSize: 13, color: C.TextSecondary },

  // ── Todo row
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E6E6E6',
    gap: 12,
  },
  todoCheckbox: { flexShrink: 0 },
  todoName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '400',
    color: '#000000',
  },
  todoDuration: { fontSize: 13, color: C.TextSecondary },

  // ── Start button wrap (sticky bottom)
  startBtnWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
});
