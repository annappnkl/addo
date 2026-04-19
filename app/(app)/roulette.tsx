import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import { supabase } from '../../src/db/supabase';
import { getTodosByUser } from '../../src/db/dao';
import {
  getSessionConfig,
  setSessionResult,
  type RollRecord,
  type SessionResult,
} from '../../src/logic/sessionStore';
import type { Todo, SideQuest } from '../../src/types';
import {
  Colors,
  PrimaryButton,
  SecondaryButton,
} from '../../src/components/ui';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fisherYates<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Pool item union ──────────────────────────────────────────────────────────

type PoolItemType = 'todo' | 'side_quest';

interface PoolItem {
  item: Todo | SideQuest;
  type: PoolItemType;
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function RouletteScreen() {
  const config = getSessionConfig();

  // Redirect if no config (e.g. deep link without session setup)
  useEffect(() => {
    if (!config) {
      router.replace('/(app)/session');
    }
  }, [config]);

  if (!config) return null;

  return <RouletteWorkMode />;
}

function RouletteWorkMode() {
  // Read config once on mount. getSessionConfig() can return null after the
  // end-session flow clears the store, but RouletteScreen's guard guarantees
  // it was non-null before this component mounted — safe to freeze in a ref.
  const configRef = useRef(getSessionConfig());
  const config = configRef.current!;

  // ── Pool state
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seenSideQuestIds, setSeenSideQuestIds] = useState<Set<string>>(new Set());
  const [doneTodoIds, setDoneTodoIds] = useState<Set<string>>(new Set());

  // ── Timing
  const sessionStartTime = useRef(Date.now());
  const lastBreakTime = useRef(Date.now());
  const [currentItemStartTime, setCurrentItemStartTime] = useState(Date.now());

  // ── Session log
  const [completedRolls, setCompletedRolls] = useState<RollRecord[]>([]);
  const [skippedTodos, setSkippedTodos] = useState<Todo[]>([]);

  // ── UI state
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [isSoftEnd, setIsSoftEnd] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(0);
  const [now, setNow] = useState(Date.now());

  // ── Animation
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ── Clock tick for progress bar and "break in X" display
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Build pool on mount
  useEffect(() => {
    async function buildPool() {
      let todos: Todo[] = config.selectedTodos;

      if (config.justShuffleEverything) {
        const { data: user } = await supabase.auth.getUser();
        if (user.user) {
          todos = await getTodosByUser(user.user.id);
        }
      }

      // Exclude 'Later' bucket from roulette
      const eligibleTodos = todos.filter((t) => t.bucket !== 'Later');

      const todoItems: PoolItem[] = eligibleTodos.map((t) => ({
        item: t,
        type: 'todo' as const,
      }));
      const sqItems: PoolItem[] = config.selectedSideQuests.map((sq) => ({
        item: sq,
        type: 'side_quest' as const,
      }));

      const shuffled = fisherYates([...todoItems, ...sqItems]);
      setPool(shuffled);
      setCurrentItemStartTime(Date.now());
    }

    void buildPool();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Effective duration (base + snooze extensions)
  const effectiveDurationMs =
    (config.durationMinutes + extraMinutes) * 60 * 1000;
  const sessionEndTime = sessionStartTime.current + effectiveDurationMs;

  // ── Session progress
  const elapsed = now - sessionStartTime.current;
  const progressRatio = Math.min(elapsed / effectiveDurationMs, 1);
  const isOverTime = elapsed >= effectiveDurationMs;
  const breakElapsed = now - lastBreakTime.current;
  const msUntilBreak = config.breakIntervalMinutes * 60 * 1000 - breakElapsed;
  const minUntilBreak = Math.max(0, Math.ceil(msUntilBreak / 60000));

  // ── Check soft end (only once)
  useEffect(() => {
    if (isOverTime && !isSoftEnd && pool.length > 0) {
      setIsSoftEnd(true);
    }
  }, [isOverTime, isSoftEnd, pool.length]);

  // ── Current item
  const activeSideQuestIds = new Set(seenSideQuestIds);
  const remainingPool = pool.filter((p) => {
    if (p.type === 'todo') return !doneTodoIds.has(p.item.id);
    return !activeSideQuestIds.has(p.item.id);
  });

  const currentItem: PoolItem | undefined = remainingPool[currentIndex % Math.max(remainingPool.length, 1)];

  // ── Transition animation helper
  function animateTransition(callback: () => void) {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      callback();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  }

  // ── Break check: if break interval elapsed, force next item to be a side quest
  function checkBreakAndAdvance(nextPool: PoolItem[], nextDoneTodoIds: Set<string>, nextSeenSqIds: Set<string>) {
    const breakDue = Date.now() - lastBreakTime.current >= config.breakIntervalMinutes * 60 * 1000;
    if (breakDue) {
      lastBreakTime.current = Date.now();
      setIsOnBreak(true);
    }
    // Pick next index from remaining after filter
    const remaining = nextPool.filter((p) => {
      if (p.type === 'todo') return !nextDoneTodoIds.has(p.item.id);
      return !nextSeenSqIds.has(p.item.id);
    });
    if (remaining.length === 0) {
      void endSession(nextPool, nextDoneTodoIds, nextSeenSqIds);
      return;
    }
    setCurrentIndex(0); // always show first of remaining
    setCurrentItemStartTime(Date.now());
  }

  // ── Done handler
  const handleDone = useCallback(() => {
    if (!currentItem) return;

    const actualMinutes = (Date.now() - currentItemStartTime) / 60000;
    const estimated =
      currentItem.type === 'todo'
        ? (currentItem.item as Todo).estimated_minutes
        : (currentItem.item as SideQuest).duration_minutes;

    const roll: RollRecord = {
      item: currentItem.item,
      type: currentItem.type,
      outcome: 'done',
      estimatedMinutes: estimated,
      actualMinutes,
      startedAt: currentItemStartTime,
    };

    const newCompletedRolls = [...completedRolls, roll];
    setCompletedRolls(newCompletedRolls);

    let newDoneTodoIds = doneTodoIds;
    let newSeenSqIds = seenSideQuestIds;

    if (currentItem.type === 'todo') {
      newDoneTodoIds = new Set([...doneTodoIds, currentItem.item.id]);
      setDoneTodoIds(newDoneTodoIds);
    } else {
      newSeenSqIds = new Set([...seenSideQuestIds, currentItem.item.id]);
      setSeenSideQuestIds(newSeenSqIds);
    }

    animateTransition(() => {
      checkBreakAndAdvance(pool, newDoneTodoIds, newSeenSqIds);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, currentItemStartTime, completedRolls, doneTodoIds, seenSideQuestIds, pool]);

  // ── Skip handler
  const handleSkip = useCallback(() => {
    if (!currentItem) return;

    const actualMinutes = (Date.now() - currentItemStartTime) / 60000;
    const estimated =
      currentItem.type === 'todo'
        ? (currentItem.item as Todo).estimated_minutes
        : (currentItem.item as SideQuest).duration_minutes;

    const roll: RollRecord = {
      item: currentItem.item,
      type: currentItem.type,
      outcome: 'skipped',
      estimatedMinutes: estimated,
      actualMinutes,
      startedAt: currentItemStartTime,
    };

    setCompletedRolls((prev) => [...prev, roll]);

    if (currentItem.type === 'todo') {
      const todo = currentItem.item as Todo;
      setSkippedTodos((prev) => {
        if (prev.some((t) => t.id === todo.id)) return prev;
        return [...prev, todo];
      });
    }

    // Move to back of pool (rotate pool so current goes last)
    animateTransition(() => {
      setPool((prev) => {
        const idx = prev.findIndex((p) => p.item.id === currentItem.item.id);
        if (idx === -1) return prev;
        const next = [...prev];
        const [removed] = next.splice(idx, 1);
        next.push(removed);
        return next;
      });
      checkBreakAndAdvance(pool, doneTodoIds, seenSideQuestIds);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, currentItemStartTime, pool, doneTodoIds, seenSideQuestIds]);

  // ── Side Quest Now handler
  const handleSideQuestNow = useCallback(() => {
    if (!currentItem) return;

    const actualMinutes = (Date.now() - currentItemStartTime) / 60000;
    const estimated =
      currentItem.type === 'todo'
        ? (currentItem.item as Todo).estimated_minutes
        : (currentItem.item as SideQuest).duration_minutes;

    // Log current item as interrupted (escape)
    const roll: RollRecord = {
      item: currentItem.item,
      type: currentItem.type,
      outcome: 'escape',
      estimatedMinutes: estimated,
      actualMinutes,
      startedAt: currentItemStartTime,
    };
    setCompletedRolls((prev) => [...prev, roll]);

    // Find a side quest not yet seen this session
    const availableSq = pool.filter(
      (p) => p.type === 'side_quest' && !seenSideQuestIds.has(p.item.id)
    );

    animateTransition(() => {
      if (availableSq.length === 0) {
        // No side quests left — just do a break
        setIsOnBreak(true);
        lastBreakTime.current = Date.now();
      } else {
        // Bring a random side quest to the front of the pool
        const pick = availableSq[Math.floor(Math.random() * availableSq.length)];
        setPool((prev) => {
          const idx = prev.findIndex((p) => p.item.id === pick.item.id);
          if (idx === -1) return prev;
          const next = [...prev];
          const [sq] = next.splice(idx, 1);
          next.unshift(sq);
          return next;
        });
      }
      setCurrentIndex(0);
      setCurrentItemStartTime(Date.now());
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentItem, currentItemStartTime, pool, seenSideQuestIds]);

  // ── Break done
  function handleBreakDone() {
    setIsOnBreak(false);
    setCurrentItemStartTime(Date.now());
  }

  // ── End session
  async function endSession(
    finalPool: PoolItem[],
    finalDoneTodoIds: Set<string>,
    finalSeenSqIds: Set<string>,
  ) {
    const endedAt = Date.now();

    const finalRolls = [...completedRolls];
    const finalSkipped = [...skippedTodos];

    // Build result
    const result: SessionResult = {
      config,
      startedAt: sessionStartTime.current,
      endedAt,
      completedRolls: finalRolls,
      skippedTodos: finalSkipped,
    };

    setSessionResult(result);

    // Sessions table requires area_id (NOT NULL FK to areas).
    // Areas feature (F7) not yet built — we skip DB persistence for now.
    // The result is stored in sessionStore for the Summary screen, which is sufficient.
    // TODO(f7): call insertSession + insertSessionRoll once area_id is available.
    void finalPool;
    void finalDoneTodoIds;
    void finalSeenSqIds;

    router.replace('/(app)/summary');
  }

  function handleFinishSession() {
    void endSession(pool, doneTodoIds, seenSideQuestIds);
  }

  function handleSnooze(minutes: number) {
    setExtraMinutes((prev) => prev + minutes);
    setIsSoftEnd(false);
  }

  if (pool.length === 0) {
    return (
      <SafeAreaView style={styles.root}>
        <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, headerShown: false }} />
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Shuffling your tasks...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, headerShown: false }} />

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={styles.topBarLeft}>Session</Text>
        <Text style={styles.topBarRight}>
          {formatElapsed(elapsed)} · break in {minUntilBreak}m
        </Text>
      </View>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${progressRatio * 100}%` },
            isOverTime && styles.progressFillOver,
          ]}
        />
      </View>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isOnBreak ? (
          <BreakCard
            elapsedMin={Math.floor((Date.now() - sessionStartTime.current) / 60000)}
            currentItem={currentItem?.type === 'side_quest' ? currentItem : undefined}
            onDone={handleBreakDone}
          />
        ) : currentItem ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <ItemCard item={currentItem} now={now} />
          </Animated.View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.display}>All done!</Text>
            <Text style={styles.subheading}>No more tasks in the pool.</Text>
          </View>
        )}

        {/* ── Action buttons ─────────────────────────────────────────────── */}
        {!isOnBreak && (
          <View style={styles.buttonsWrap}>
            <PrimaryButton label="Done, next" onPress={handleDone} />
            <SecondaryButton label="Skip" onPress={handleSkip} />
            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleSideQuestNow}
              activeOpacity={0.85}
            >
              <Text style={styles.ghostBtnText}>Side Quest now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <Text style={styles.footer}>Session ends at {formatHHMM(sessionEndTime)}</Text>
      </ScrollView>

      {/* ── Soft end overlay ────────────────────────────────────────────── */}
      {isSoftEnd && (
        <View style={styles.softEndOverlay}>
          <View style={styles.softEndCard}>
            <Text style={styles.softEndTitle}>
              {"Time's up! Your "}{formatElapsed(effectiveDurationMs)}{" session is done."}
            </Text>
            <Text style={styles.softEndBody}>Keep going or wrap up?</Text>
            <View style={styles.snoozeRow}>
              {([15, 30, 60] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={styles.snoozeBtn}
                  onPress={() => handleSnooze(m)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.snoozeBtnText}>+{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <PrimaryButton label="Finish session" onPress={handleFinishSession} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Item card ────────────────────────────────────────────────────────────────

function ItemCard({ item, now }: { item: PoolItem; now: number }) {
  if (item.type === 'todo') {
    const todo = item.item as Todo;
    const finishBy = now + todo.estimated_minutes * 60 * 1000;
    const bucketLabel = todo.bucket === 'Must' ? 'Must' : 'Want';
    return (
      <View style={styles.card}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>{bucketLabel}</Text>
        </View>
        <Text style={styles.display}>{todo.title}</Text>
        <Text style={styles.subheadingSecondary}>~ {todo.estimated_minutes} min</Text>
        <Text style={styles.caption}>Finish by {formatHHMM(finishBy)}</Text>
      </View>
    );
  }

  const sq = item.item as SideQuest;
  return (
    <View style={[styles.card, styles.cardSideQuest]}>
      <View style={[styles.pill, styles.pillSideQuest]}>
        <Text style={[styles.pillText, styles.pillTextSideQuest]}>🎲 Side Quest</Text>
      </View>
      <Text style={styles.display}>{sq.title}</Text>
      <Text style={styles.subheadingSecondary}>~ {sq.duration_minutes} min</Text>
      {sq.link ? (
        <TouchableOpacity onPress={() => void Linking.openURL(sq.link!)}>
          <Text style={styles.link}>Open link</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Break card ───────────────────────────────────────────────────────────────

function BreakCard({
  elapsedMin,
  currentItem,
  onDone,
}: {
  elapsedMin: number;
  currentItem: PoolItem | undefined;
  onDone: () => void;
}) {
  return (
    <View style={[styles.card, styles.cardBreak]}>
      <View style={[styles.pill, styles.pillBreak]}>
        <Text style={[styles.pillText, styles.pillTextBreak]}>🌿 Break time</Text>
      </View>
      <Text style={styles.breakBody}>
        {"You've been working for "}{elapsedMin}{" min. Take a breather."}
      </Text>
      {currentItem && (
        <View style={styles.breakSqWrap}>
          <Text style={styles.caption}>Or try this side quest:</Text>
          <Text style={styles.subheading}>{currentItem.item.title}</Text>
        </View>
      )}
      <View style={styles.breakBtn}>
        <PrimaryButton label="Done, back to work" onPress={onDone} />
      </View>
    </View>
  );
}


// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 17, color: Colors.textSecondary },

  // ── Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  topBarLeft: { fontSize: 13, color: Colors.textSecondary },
  topBarRight: { fontSize: 13, color: Colors.textSecondary },

  // ── Progress bar
  progressTrack: {
    height: 4,
    backgroundColor: Colors.borderWarm,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  progressFillOver: { backgroundColor: Colors.destructive },

  // ── Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 16,
    flexGrow: 1,
    justifyContent: 'center',
  },

  // ── Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 12,
  },
  cardSideQuest: { backgroundColor: Colors.accentLight },
  cardBreak: { backgroundColor: '#F0FFF4' },

  // ── Pill label
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentLight,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pillSideQuest: { backgroundColor: '#FFD9B8', borderRadius: 999 },
  pillBreak: { backgroundColor: '#DCFCE7', borderRadius: 999 },
  pillText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  pillTextSideQuest: { color: '#F97316' },
  pillTextBreak: { color: '#16A34A' },

  // ── Typography
  display: { fontSize: 32, fontWeight: '700', color: Colors.textPrimary },
  subheading: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  subheadingSecondary: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },
  caption: { fontSize: 13, color: Colors.textSecondary },
  link: { fontSize: 13, color: Colors.accent, fontWeight: '600' },

  // ── Break card extras
  breakBody: { fontSize: 15, color: Colors.textSecondary },
  breakSqWrap: { gap: 4, marginTop: 8 },
  breakBtn: { marginTop: 8 },

  // ── Buttons
  buttonsWrap: { gap: 12 },
  ghostBtn: {
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  ghostBtnText: { color: Colors.accent, fontSize: 17, fontWeight: '600' },

  // ── Footer
  footer: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginTop: 8,
  },

  // ── Soft end overlay
  softEndOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  softEndCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 16,
  },
  softEndTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  softEndBody: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  snoozeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  snoozeBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 28,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snoozeBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
