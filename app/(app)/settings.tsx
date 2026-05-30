import { useEffect, useState } from 'react';
import { Alert, Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/db/supabase';
import { getSettings, upsertSettings } from '../../src/db/dao';
import { TOS_URL, PRIVACY_URL } from '../../src/constants/legal';
import { Colors, Chip } from '../../src/components/ui';

const BREAK_OPTIONS = [25, 30, 45, 50, 60] as const;
const SIDE_QUEST_OPTIONS = [10, 20, 30, 40, 50] as const;

export default function SettingsScreen() {
  const [breakInterval, setBreakInterval] = useState(50);
  const [sideQuestRatio, setSideQuestRatio] = useState(30);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      const settings = await getSettings(user.id);
      if (settings) {
        setBreakInterval(settings.break_interval_minutes);
        // stored as 0–1 decimal, display as %
        setSideQuestRatio(Math.round(settings.side_quest_ratio * 100));
      }
      setLoading(false);
    });
  }, []);

  async function handleBreakInterval(minutes: number) {
    setBreakInterval(minutes);
    if (userId) await upsertSettings(userId, { break_interval_minutes: minutes });
  }

  async function handleSideQuestRatio(pct: number) {
    setSideQuestRatio(pct);
    if (userId) await upsertSettings(userId, { side_quest_ratio: pct / 100 });
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete all your data. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            // TODO: trigger server-side deletion of all user data before sign-out.
            // For now, signing out removes access; data remains in DB until manual purge.
            await supabase.auth.signOut();
            router.replace('/(auth)/sign-in');
          },
        },
      ]
    );
  }

  if (loading) return null;

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* ── Break interval ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Break interval</Text>
        <View style={styles.chipsRow}>
          {BREAK_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={`${m}m`}
              selected={breakInterval === m}
              onPress={() => handleBreakInterval(m)}
              size="sm"
            />
          ))}
        </View>

        {/* ── Side quest mix ───────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Side quest mix</Text>
        <Text style={styles.sectionCaption}>% of session that's fun</Text>
        <View style={styles.chipsRow}>
          {SIDE_QUEST_OPTIONS.map((pct) => (
            <Chip
              key={pct}
              label={`${pct}%`}
              selected={sideQuestRatio === pct}
              onPress={() => handleSideQuestRatio(pct)}
              size="sm"
            />
          ))}
        </View>

        {/* ── Areas ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Areas</Text>
        <View style={styles.list}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/(app)/areas')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Areas</Text>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Legal ───────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Legal</Text>
        <View style={styles.list}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(PRIVACY_URL)}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.row}
            onPress={() => Linking.openURL(TOS_URL)}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Terms of Service</Text>
            <Feather name="chevron-right" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Account ─────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.list}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Export my data</Text>
            <Text style={styles.rowMeta}>Coming soon</Text>
          </View>
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>Delete my account</Text>
            <Feather name="chevron-right" size={20} color={Colors.destructive} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 48 },

  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },

  sectionLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCaption: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: -4,
    marginBottom: 8,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },

  list: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  rowLabel: { fontSize: 16, color: Colors.textPrimary },
  rowLabelDestructive: { color: Colors.destructive },
  rowMeta: { fontSize: 14, color: Colors.textSecondary },
});
