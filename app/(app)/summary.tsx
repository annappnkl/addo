import { useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import {
  getSessionResult,
  clearSession,
  type RollRecord,
} from '../../src/logic/sessionStore';
import type { Todo, SideQuest } from '../../src/types';

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

function formatMin(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = Math.round(totalMin % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export default function SummaryScreen() {
  const result = getSessionResult();

  useEffect(() => {
    if (!result) {
      router.replace('/(app)/tasks');
      return;
    }
    clearSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;

  const plannedMin = result.config.durationMinutes;
  const actualMin = Math.round((result.endedAt - result.startedAt) / 60000);
  const isUnder = actualMin <= plannedMin;

  const completedTodoRolls = result.completedRolls.filter(
    (r): r is RollRecord & { type: 'todo'; outcome: 'done' } =>
      r.type === 'todo' && r.outcome === 'done'
  );

  const completedSqRolls = result.completedRolls.filter(
    (r): r is RollRecord & { type: 'side_quest'; outcome: 'done' } =>
      r.type === 'side_quest' && r.outcome === 'done'
  );

  const escapeCount = result.completedRolls.filter((r) => r.outcome === 'escape').length;

  return (
    <SafeAreaView style={styles.root}>
      <Tabs.Screen options={{ tabBarStyle: { display: 'none' }, headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header card ─────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.heading}>Session complete</Text>
          <Text style={styles.caption}>Session</Text>
          <View style={styles.durationRow}>
            <Text style={styles.subheading}>Planned</Text>
            <Text style={styles.subheading}>{formatMin(plannedMin)}</Text>
          </View>
          <View style={styles.durationRow}>
            <Text style={styles.subheading}>Actual</Text>
            <Text style={[styles.subheading, isUnder ? styles.accentText : styles.destructiveText]}>
              {formatMin(actualMin)}
            </Text>
          </View>
        </View>

        {/* ── Completed todos ─────────────────────────────────────────── */}
        {completedTodoRolls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COMPLETED</Text>
            {completedTodoRolls.map((r, i) => {
              const todo = r.item as Todo;
              return (
                <View key={`done-${todo.id}-${i}`} style={styles.card}>
                  <View style={styles.rollRow}>
                    <Text style={styles.rollName}>{todo.title}</Text>
                    <Text style={styles.rollMeta}>
                      {Math.round(r.actualMinutes)}m (est. {r.estimatedMinutes}m)
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Side quests ─────────────────────────────────────────────── */}
        {completedSqRolls.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SIDE QUESTS</Text>
            {completedSqRolls.map((r, i) => {
              const sq = r.item as SideQuest;
              return (
                <View key={`sq-${sq.id}-${i}`} style={styles.card}>
                  <View style={styles.rollRow}>
                    <Text style={styles.rollName}>{sq.title}</Text>
                    <Text style={styles.rollMeta}>
                      {Math.round(r.actualMinutes)}m
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Skipped todos ───────────────────────────────────────────── */}
        {result.skippedTodos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SKIPPED — BACK TO POOL</Text>
            {result.skippedTodos.map((todo) => (
              <View key={`skipped-${todo.id}`} style={styles.card}>
                <Text style={styles.skippedName}>{todo.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Escape count ────────────────────────────────────────────── */}
        {escapeCount > 0 && (
          <Text style={styles.escapeCaption}>
            Side quest escapes: {escapeCount}
          </Text>
        )}

        {/* ── CTAs ────────────────────────────────────────────────────── */}
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.replace('/(app)/session')}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Start another session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.replace('/(app)/tasks')}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Back to tasks</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.Bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // ── Typography
  heading: { fontSize: 22, fontWeight: '700', color: C.TextPrimary },
  subheading: { fontSize: 17, fontWeight: '600', color: C.TextPrimary },
  caption: { fontSize: 13, color: C.TextSecondary },
  accentText: { color: C.Accent },
  destructiveText: { color: C.Destructive },

  // ── Card
  card: {
    backgroundColor: C.Surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    gap: 8,
  },

  // ── Duration rows
  durationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // ── Section
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 13,
    color: C.TextSecondary,
    fontWeight: '400',
    letterSpacing: 0.5,
  },

  // ── Roll row
  rollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rollName: { fontSize: 17, fontWeight: '600', color: C.TextPrimary, flex: 1 },
  rollMeta: { fontSize: 13, color: C.TextSecondary, flexShrink: 0 },

  // ── Skipped
  skippedName: { fontSize: 17, fontWeight: '600', color: C.TextSecondary },

  // ── Escape caption
  escapeCaption: { fontSize: 13, color: C.TextSecondary },

  // ── CTAs
  ctaWrap: { gap: 12, marginTop: 8 },
  primaryBtn: {
    backgroundColor: C.Accent,
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    backgroundColor: C.SurfaceAlt,
    borderRadius: 28,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtnText: { color: C.TextPrimary, fontSize: 17, fontWeight: '600' },
});
