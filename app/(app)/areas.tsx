import { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../src/db/supabase';
import {
  getAreasByUser,
  getSubgoalsByArea,
  insertArea,
  insertSubgoal,
  deleteArea,
  deleteSubgoal,
} from '../../src/db/dao';
import type { Area, Subgoal } from '../../src/types';
import {
  Colors,
  FontSize,
  FontWeight,
  FieldInput,
} from '../../src/components/ui';
import { Feather } from '@expo/vector-icons';

export default function AreasScreen() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [subgoalsByArea, setSubgoalsByArea] = useState<Record<string, Subgoal[]>>({});
  const [expandedAreaId, setExpandedAreaId] = useState<string | null>(null);
  const [newAreaName, setNewAreaName] = useState('');
  const [newSubgoalName, setNewSubgoalName] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [deletingAreaId, setDeletingAreaId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        void loadAreas(user.id);
      }
    });
  }, []);

  async function loadAreas(uid: string) {
    const loaded = await getAreasByUser(uid);
    setAreas(loaded);
    const byArea: Record<string, Subgoal[]> = {};
    await Promise.all(
      loaded.map(async (a) => {
        byArea[a.id] = await getSubgoalsByArea(a.id);
      })
    );
    setSubgoalsByArea(byArea);
  }

  async function handleAddArea() {
    if (!userId || !newAreaName.trim()) return;
    await insertArea(userId, newAreaName.trim());
    setNewAreaName('');
    await loadAreas(userId);
  }

  async function handleAddSubgoal() {
    if (!userId || !expandedAreaId || !newSubgoalName.trim()) return;
    const name = newSubgoalName.trim();
    const hashtag = '#' + name.replace(/\s+/g, '');
    await insertSubgoal(userId, expandedAreaId, name, hashtag);
    setNewSubgoalName('');
    const updated = await getSubgoalsByArea(expandedAreaId);
    setSubgoalsByArea((prev) => ({ ...prev, [expandedAreaId]: updated }));
  }

  async function handleDeleteSubgoal(subgoalId: string, areaId: string) {
    await deleteSubgoal(subgoalId);
    const updated = await getSubgoalsByArea(areaId);
    setSubgoalsByArea((prev) => ({ ...prev, [areaId]: updated }));
  }

  function confirmDeleteArea(areaId: string) {
    if (Platform.OS === 'web') {
      setDeletingAreaId(areaId);
    } else {
      Alert.alert(
        'Delete Area',
        'This will also delete all subgoals in this area. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => void executeDeleteArea(areaId),
          },
        ]
      );
    }
  }

  async function executeDeleteArea(areaId: string) {
    await deleteArea(areaId);
    setDeletingAreaId(null);
    if (expandedAreaId === areaId) setExpandedAreaId(null);
    if (userId) await loadAreas(userId);
  }

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Areas</Text>
      </View>

      {/* ── Add area ──────────────────────────────────────────────────── */}
      <View style={styles.addRow}>
        <FieldInput
          style={styles.addInput}
          value={newAreaName}
          onChangeText={setNewAreaName}
          placeholder="New area name"
          onSubmitEditing={() => void handleAddArea()}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, { opacity: newAreaName.trim() ? 1 : 0.35 }]}
          onPress={() => void handleAddArea()}
          disabled={!newAreaName.trim()}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {areas.length === 0 && (
          <Text style={styles.emptyText}>No areas yet. Add one above.</Text>
        )}

        {areas.map((area) => {
          const isExpanded = expandedAreaId === area.id;
          const sgs = subgoalsByArea[area.id] ?? [];
          const isConfirmingDelete = deletingAreaId === area.id;

          return (
            <View key={area.id}>
              {/* ── Area row ──────────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.areaRow}
                onPress={() => {
                  setExpandedAreaId(isExpanded ? null : area.id);
                  setNewSubgoalName('');
                  setDeletingAreaId(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.areaName}>{area.name}</Text>
                <Feather
                  name={isExpanded ? 'chevron-down' : 'chevron-right'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {/* ── Expanded area ─────────────────────────────────────── */}
              {isExpanded && (
                <View style={styles.expandedArea}>
                  {/* Add subgoal row */}
                  <View style={styles.addRow}>
                    <FieldInput
                      style={styles.addInput}
                      value={newSubgoalName}
                      onChangeText={setNewSubgoalName}
                      placeholder="New subgoal name"
                      onSubmitEditing={() => void handleAddSubgoal()}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={[styles.addBtn, { opacity: newSubgoalName.trim() ? 1 : 0.35 }]}
                      onPress={() => void handleAddSubgoal()}
                      disabled={!newSubgoalName.trim()}
                      activeOpacity={0.8}
                    >
                      <Feather name="plus" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Subgoal rows */}
                  {sgs.map((sg) => (
                    <View key={sg.id} style={styles.subgoalRow}>
                      <Text style={styles.subgoalHashtag}>{sg.hashtag}</Text>
                      <Text style={styles.subgoalName}>{sg.name}</Text>
                      <TouchableOpacity
                        onPress={() => void handleDeleteSubgoal(sg.id, area.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather name="trash-2" size={16} color={Colors.destructive} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Delete area — web inline confirm, native Alert */}
                  {isConfirmingDelete ? (
                    <View style={styles.deleteConfirmRow}>
                      <Text style={styles.deleteConfirmText}>
                        Delete area and all its subgoals?
                      </Text>
                      <TouchableOpacity onPress={() => void executeDeleteArea(area.id)}>
                        <Text style={styles.deleteConfirmYes}>Yes, delete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setDeletingAreaId(null)}>
                        <Text style={styles.deleteConfirmCancel}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteAreaBtn}
                      onPress={() => confirmDeleteArea(area.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.deleteAreaText}>Delete area</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: FontSize.heading, fontWeight: FontWeight.bold, color: Colors.textPrimary },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
  },
  addInput: { flex: 1 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  list: { paddingBottom: 48 },
  emptyText: {
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  areaName: { fontSize: FontSize.body, fontWeight: FontWeight.semibold, color: Colors.textPrimary },

  expandedArea: {
    backgroundColor: Colors.surfaceAlt,
    paddingTop: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },

  subgoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    borderTopWidth: 0.5,
    borderTopColor: Colors.borderSubtle,
  },
  subgoalHashtag: {
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    width: 90,
  },
  subgoalName: { flex: 1, fontSize: FontSize.body, color: Colors.textPrimary },

  deleteAreaBtn: { paddingVertical: 14, paddingHorizontal: 20 },
  deleteAreaText: { fontSize: FontSize.label, color: Colors.destructive },

  deleteConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexWrap: 'wrap',
  },
  deleteConfirmText: { fontSize: FontSize.label, color: Colors.textSecondary, flex: 1 },
  deleteConfirmYes: { fontSize: FontSize.label, color: Colors.destructive, fontWeight: FontWeight.semibold },
  deleteConfirmCancel: { fontSize: FontSize.label, color: Colors.textSecondary },
});
