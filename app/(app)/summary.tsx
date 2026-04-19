import { useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, Tabs } from 'expo-router';
import {
  getSessionResult,
  clearSession,
  type RollRecord,
} from '../../src/logic/sessionStore';
import type { Todo, SideQuest } from '../../src/types';
import {
  Colors,
  PrimaryButton,
  SecondaryButton,
  ListRow,
  ItemMeta,
  SectionHeader,
} from '../../src/components/ui';

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
            <SectionHeader label="COMPLETED" />
            {completedTodoRolls.map((r, i) => {
              const todo = r.item as Todo;
              return (
                <ListRow key={`done-${todo.id}-${i}`}>
                  <Text style={styles.rollName}>{todo.title}</Text>
                  <ItemMeta>{`${Math.round(r.actualMinutes)}m (est. ${r.estimatedMinutes}m)`}</ItemMeta>
                </ListRow>
              );
            })}
          </View>
        )}

        {/* ── Side quests ─────────────────────────────────────────────── */}
        {completedSqRolls.length > 0 && (
          <View style={styles.section}>
            <SectionHeader label="SIDE QUESTS" />
            {completedSqRolls.map((r, i) => {
              const sq = r.item as SideQuest;
              return (
                <ListRow key={`sq-${sq.id}-${i}`}>
                  <Text style={styles.rollName}>{sq.title}</Text>
                  <ItemMeta>{`${Math.round(r.actualMinutes)}m`}</ItemMeta>
                </ListRow>
              );
            })}
          </View>
        )}

        {/* ── Skipped todos ───────────────────────────────────────────── */}
        {result.skippedTodos.length > 0 && (
          <View style={styles.section}>
            <SectionHeader label="SKIPPED — BACK TO POOL" />
            {result.skippedTodos.map((todo) => (
              <ListRow key={`skipped-${todo.id}`}>
                <Text style={styles.skippedName}>{todo.title}</Text>
              </ListRow>
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
          <PrimaryButton
            label="Start another session"
            onPress={() => router.replace('/(app)/session')}
          />
          <SecondaryButton
            label="Back to tasks"
            onPress={() => router.replace('/(app)/tasks')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 24,
  },

  // ── Typography
  heading: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subheading: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },
  caption: { fontSize: 13, color: Colors.textSecondary },
  accentText: { color: Colors.accent },
  destructiveText: { color: Colors.destructive },

  // ── Card (header only)
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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

  // ── Roll rows
  rollName: { fontSize: 17, fontWeight: '400', color: Colors.taskName, flex: 1 },
  skippedName: { fontSize: 17, fontWeight: '400', color: Colors.textMuted },

  // ── Escape caption
  escapeCaption: { fontSize: 13, color: Colors.textSecondary },

  // ── CTAs
  ctaWrap: { gap: 12, marginTop: 8 },
});
