import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { supabase } from '../../src/db/supabase';
import { insertTodo, updateTodo, deleteTodo, getTodosByUser } from '../../src/db/dao';
import { bucketTotalMinutes, formatMinutes } from '../../src/logic/todos';
import type { Todo, Bucket } from '../../src/types';

const BUCKETS: Bucket[] = ['Must', 'Want', 'Later'];

const BUCKET_LABELS: Record<Bucket, string> = {
  Must: 'Must',
  Want: 'Want',
  Later: 'Later',
};

const BUCKET_DESCRIPTIONS: Record<Bucket, string> = {
  Must: 'Has external deadline or commitment',
  Want: 'Something you owe yourself',
  Later: 'Brain dump — not yet sorted',
};

interface EditingTodo {
  id: string | null; // null = new todo
  title: string;
  estimated_minutes: number;
  bucket: Bucket;
  notes: string;
}

const DEFAULT_EDITING: EditingTodo = {
  id: null,
  title: '',
  estimated_minutes: 30,
  bucket: 'Must',
  notes: '',
};

export default function TasksScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<EditingTodo>(DEFAULT_EDITING);
  const [activeBucket, setActiveBucket] = useState<Bucket>('Must');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        loadTodos(user.id);
      }
    });
  }, []);

  async function loadTodos(uid: string) {
    setTodos(await getTodosByUser(uid));
  }

  const openNew = useCallback((bucket: Bucket) => {
    setEditing({ ...DEFAULT_EDITING, bucket });
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((todo: Todo) => {
    setEditing({
      id: todo.id,
      title: todo.title,
      estimated_minutes: todo.estimated_minutes,
      bucket: todo.bucket,
      notes: todo.notes ?? '',
    });
    setModalVisible(true);
  }, []);

  function closeModal() {
    setModalVisible(false);
    setEditing(DEFAULT_EDITING);
  }

  async function save() {
    if (!userId) return;
    const title = editing.title.trim();
    if (!title) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }

    const minutes = Number(editing.estimated_minutes);
    if (!Number.isInteger(minutes) || minutes < 1) {
      Alert.alert('Invalid duration', 'Please enter a duration in whole minutes (at least 1).');
      return;
    }

    setSaving(true);

    if (editing.id === null) {
      await insertTodo(
        userId,
        title,
        minutes,
        editing.bucket,
        null,
        editing.notes.trim() || null
      );
    } else {
      await updateTodo(editing.id, {
        title,
        estimated_minutes: minutes,
        bucket: editing.bucket,
        notes: editing.notes.trim() || null,
      });
    }

    await loadTodos(userId);
    setSaving(false);
    closeModal();
  }

  function confirmDelete(id: string) {
    Alert.alert(
      'Delete task',
      'Remove this task from your pool?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTodo(id).then(() => { if (userId) loadTodos(userId); });
          },
        },
      ]
    );
  }

  const bucketTodos = todos.filter((t) => t.bucket === activeBucket);

  return (
    <SafeAreaView style={styles.root}>
      {/* Bucket tabs */}
      <View style={styles.tabs}>
        {BUCKETS.map((b) => (
          <TouchableOpacity
            key={b}
            style={[styles.tab, activeBucket === b && styles.tabActive]}
            onPress={() => setActiveBucket(b)}
          >
            <Text style={[styles.tabLabel, activeBucket === b && styles.tabLabelActive]}>
              {BUCKET_LABELS[b]}
            </Text>
            <Text style={[styles.tabTime, activeBucket === b && styles.tabTimeActive]}>
              {formatMinutes(bucketTotalMinutes(todos, b))}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bucket description */}
      <Text style={styles.bucketDesc}>{BUCKET_DESCRIPTIONS[activeBucket]}</Text>

      {/* Todo list */}
      <FlatList
        data={bucketTodos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nothing here yet — add your first task</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.todoRow} onPress={() => openEdit(item)}>
            <View style={styles.todoMain}>
              <Text style={styles.todoTitle}>{item.title}</Text>
              <Text style={styles.todoTime}>{formatMinutes(item.estimated_minutes)}</Text>
            </View>
            {item.notes ? <Text style={styles.todoNotes} numberOfLines={1}>{item.notes}</Text> : null}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => confirmDelete(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Add button */}
      <TouchableOpacity style={styles.addButton} onPress={() => openNew(activeBucket)}>
        <Text style={styles.addButtonText}>+ Add task</Text>
      </TouchableOpacity>

      {/* Edit / Add modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <SafeAreaView style={styles.modalRoot}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editing.id ? 'Edit task' : 'New task'}
              </Text>
              <TouchableOpacity onPress={save} disabled={saving}>
                <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                  {saving ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="What needs doing?"
                placeholderTextColor="#999"
                value={editing.title}
                onChangeText={(v) => setEditing((e) => ({ ...e, title: v }))}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Estimated minutes</Text>
              <TextInput
                style={styles.fieldInput}
                keyboardType="number-pad"
                value={String(editing.estimated_minutes)}
                onChangeText={(v) => {
                  const n = parseInt(v, 10);
                  if (!isNaN(n)) setEditing((e) => ({ ...e, estimated_minutes: n }));
                  else if (v === '') setEditing((e) => ({ ...e, estimated_minutes: 0 }));
                }}
              />

              <Text style={styles.fieldLabel}>Bucket</Text>
              <View style={styles.bucketPicker}>
                {BUCKETS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[
                      styles.bucketOption,
                      editing.bucket === b && styles.bucketOptionActive,
                    ]}
                    onPress={() => setEditing((e) => ({ ...e, bucket: b }))}
                  >
                    <Text
                      style={[
                        styles.bucketOptionText,
                        editing.bucket === b && styles.bucketOptionTextActive,
                      ]}
                    >
                      {b}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.bucketHint}>{BUCKET_DESCRIPTIONS[editing.bucket]}</Text>

              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldTextarea]}
                placeholder="Any context or links…"
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                value={editing.notes}
                onChangeText={(v) => setEditing((e) => ({ ...e, notes: v }))}
              />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1a1a1a' },
  tabLabel: { fontSize: 15, fontWeight: '600', color: '#999' },
  tabLabelActive: { color: '#1a1a1a' },
  tabTime: { fontSize: 12, color: '#bbb', marginTop: 2 },
  tabTimeActive: { color: '#666' },

  bucketDesc: { fontSize: 13, color: '#999', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 },

  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
  emptyState: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: '#bbb', fontSize: 15 },

  todoRow: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    position: 'relative',
  },
  todoMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  todoTitle: { fontSize: 16, fontWeight: '500', color: '#1a1a1a', flex: 1, marginRight: 8 },
  todoTime: { fontSize: 13, color: '#666', fontVariant: ['tabular-nums'] },
  todoNotes: { fontSize: 13, color: '#999', marginTop: 4 },
  deleteBtn: { position: 'absolute', top: 10, right: 10, padding: 4 },
  deleteBtnText: { fontSize: 14, color: '#ccc' },

  addButton: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  modalRoot: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalCancel: { fontSize: 16, color: '#666' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  modalSaveDisabled: { opacity: 0.4 },

  modalBody: { flex: 1, padding: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1a1a1a',
  },
  fieldTextarea: { minHeight: 80, textAlignVertical: 'top' },

  bucketPicker: { flexDirection: 'row', gap: 8 },
  bucketOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  bucketOptionActive: { borderColor: '#1a1a1a', backgroundColor: '#1a1a1a' },
  bucketOptionText: { fontSize: 14, fontWeight: '500', color: '#666' },
  bucketOptionTextActive: { color: '#fff' },
  bucketHint: { fontSize: 12, color: '#999', marginTop: 6 },
});
