import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/db/supabase';
import {
  getSideQuestsByUser,
  insertSideQuest,
  updateSideQuest,
  deleteSideQuest,
} from '../../src/db/dao';
import type { SideQuest } from '../../src/types';

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

const DURATION_OPTIONS = [3, 5, 10, 15] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const SWIPE_WIDTH = 72;

// React Native Web supports onMouseEnter/onMouseLeave on View but they are not
// typed in base @types/react-native. This typed wrapper avoids `any`.
type WebHoverExtras = { onMouseEnter?: () => void; onMouseLeave?: () => void };
const HoverableView = View as React.ComponentType<ViewProps & WebHoverExtras>;

// ─── Edit draft ───────────────────────────────────────────────────────────────
interface EditDraft {
  title: string;
  duration: DurationOption | null;
  link: string;
  notes: string;
}

function draftFromSideQuest(sq: SideQuest): EditDraft {
  const matched = (DURATION_OPTIONS as readonly number[]).includes(sq.duration_minutes)
    ? (sq.duration_minutes as DurationOption)
    : null;
  return {
    title: sq.title,
    duration: matched,
    link: sq.link ?? '',
    notes: sq.notes ?? '',
  };
}

// ─── Duration pills (shared between add form and edit form) ───────────────────
function DurationPills({
  selected,
  onSelect,
}: {
  selected: DurationOption | null;
  onSelect: (d: DurationOption) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillsScroll}
      contentContainerStyle={styles.pillsRow}
    >
      {DURATION_OPTIONS.map((d) => (
        <TouchableOpacity
          key={d}
          style={[styles.pill, selected === d && styles.pillSelected]}
          onPress={() => onSelect(d)}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selected === d && styles.pillTextSelected]}>
            {d}m
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Link input with icon ─────────────────────────────────────────────────────
function LinkInput({
  value,
  onChangeText,
  focused,
  onFocus,
  onBlur,
}: {
  value: string;
  onChangeText: (v: string) => void;
  focused: boolean;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <View style={[styles.linkInputWrap, focused && styles.linkInputWrapFocused]}>
      <Feather name="link" size={16} color={C.TextDisabled} style={styles.linkIcon} />
      <TextInput
        style={styles.linkInputField}
        value={value}
        onChangeText={onChangeText}
        placeholder="Optional link (YouTube, article…)"
        placeholderTextColor={C.TextDisabled}
        autoCapitalize="none"
        keyboardType="url"
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </View>
  );
}

// ─── Inline edit form (inside expanded card) ──────────────────────────────────
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
  const [linkFocused, setLinkFocused] = useState(false);
  const [notesFocused, setNotesFocused] = useState(false);
  const canSave = draft.title.trim().length > 0 && draft.duration !== null;

  return (
    <View style={styles.editForm}>
      <TextInput
        style={[styles.editInput, titleFocused && styles.editInputFocused]}
        value={draft.title}
        onChangeText={(v) => onChange({ ...draft, title: v })}
        placeholder="Side quest title"
        placeholderTextColor={C.TextDisabled}
        onFocus={() => setTitleFocused(true)}
        onBlur={() => setTitleFocused(false)}
        autoFocus
      />

      <DurationPills
        selected={draft.duration}
        onSelect={(d) => onChange({ ...draft, duration: d })}
      />

      <LinkInput
        value={draft.link}
        onChangeText={(v) => onChange({ ...draft, link: v })}
        focused={linkFocused}
        onFocus={() => setLinkFocused(true)}
        onBlur={() => setLinkFocused(false)}
      />

      <TextInput
        style={[
          styles.editInput,
          styles.editNotesInput,
          notesFocused && styles.editInputFocused,
        ]}
        value={draft.notes}
        onChangeText={(v) => onChange({ ...draft, notes: v })}
        placeholder="Notes…"
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

// ─── SideQuestCard ────────────────────────────────────────────────────────────
function SideQuestCard({
  sq,
  isExpanded,
  draft,
  isSaving,
  onTap,
  onDelete,
  onDraftChange,
  onSave,
}: {
  sq: SideQuest;
  isExpanded: boolean;
  draft: EditDraft;
  isSaving: boolean;
  onTap: () => void;
  onDelete: () => void;
  onDraftChange: (d: EditDraft) => void;
  onSave: () => void;
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
      <Text style={styles.sqName} numberOfLines={1}>{sq.title}</Text>
      <Feather name="chevron-up" size={16} color={C.TextSecondary} />
    </TouchableOpacity>
  );

  function openLink() {
    if (sq.link) void Linking.openURL(sq.link);
  }

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
          <TouchableOpacity onPress={onTap} style={styles.cardText} activeOpacity={0.8}>
            <Text style={styles.sqName}>{sq.title}</Text>
            <Text style={styles.sqDuration}>{sq.duration_minutes}m</Text>
          </TouchableOpacity>

          <View style={styles.cardRight}>
            {sq.link ? (
              <TouchableOpacity
                onPress={openLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.linkIconBtn}
              >
                <Feather name="external-link" size={16} color={C.Accent} />
              </TouchableOpacity>
            ) : null}

            {/* Trash icon — always in DOM, revealed via opacity on hover */}
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
        <TouchableOpacity onPress={onTap} activeOpacity={0.8}>
          <View style={styles.cardRow}>
            <View style={styles.cardText}>
              <Text style={styles.sqName}>{sq.title}</Text>
              <Text style={styles.sqDuration}>{sq.duration_minutes}m</Text>
            </View>
            {sq.link ? (
              <TouchableOpacity
                onPress={openLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.linkIconBtn}
              >
                <Feather name="external-link" size={16} color={C.Accent} />
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── QuestsScreen ─────────────────────────────────────────────────────────────
export default function QuestsScreen() {
  const [sideQuests, setSideQuests] = useState<SideQuest[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Add form
  const [title, setTitle] = useState('');
  const [titleFocused, setTitleFocused] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
  const [link, setLink] = useState('');
  const [linkFocused, setLinkFocused] = useState(false);
  const [adding, setAdding] = useState(false);

  // Inline edit
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft>({ title: '', duration: null, link: '', notes: '' });
  const [editSaving, setEditSaving] = useState(false);

  const canAdd = title.trim().length > 0 && selectedDuration !== null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        void load(user.id);
      }
    });
  }, []);

  async function load(uid: string) {
    setSideQuests(await getSideQuestsByUser(uid));
  }

  async function handleAdd() {
    if (!userId || !canAdd || selectedDuration === null) return;
    setAdding(true);
    const now = new Date().toISOString();
    await insertSideQuest({
      user_id: userId,
      title: title.trim(),
      duration_minutes: selectedDuration,
      link: link.trim() || null,
      notes: null,
      updated_at: now,
      synced_at: null,
    });
    setTitle('');
    setSelectedDuration(null);
    setLink('');
    await load(userId);
    setAdding(false);
  }

  async function handleDelete(id: string) {
    if (expandedId === id) setExpandedId(null);
    await deleteSideQuest(id);
    if (userId) await load(userId);
  }

  function handleToggle(sq: SideQuest) {
    if (expandedId === sq.id) {
      setExpandedId(null);
    } else {
      setExpandedId(sq.id);
      setDraft(draftFromSideQuest(sq));
    }
  }

  async function handleSave() {
    if (!expandedId || !draft.title.trim() || draft.duration === null) return;
    setEditSaving(true);
    await updateSideQuest(expandedId, {
      title: draft.title.trim(),
      duration_minutes: draft.duration,
      link: draft.link.trim() || null,
      notes: draft.notes.trim() || null,
    });
    setExpandedId(null);
    if (userId) await load(userId);
    setEditSaving(false);
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Screen title ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.screenTitle}>Side Quests</Text>
        </View>

        {/* ── Add side quest area ───────────────────────────────────────── */}
        <View style={styles.addArea}>
          <TextInput
            style={[styles.titleInput, titleFocused && styles.titleInputFocused]}
            placeholder="e.g. Drink a glass of water"
            placeholderTextColor={C.TextDisabled}
            value={title}
            onChangeText={setTitle}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
            returnKeyType="done"
          />

          <DurationPills
            selected={selectedDuration}
            onSelect={(d) => setSelectedDuration(selectedDuration === d ? null : d)}
          />

          <LinkInput
            value={link}
            onChangeText={setLink}
            focused={linkFocused}
            onFocus={() => setLinkFocused(true)}
            onBlur={() => setLinkFocused(false)}
          />

          <TouchableOpacity
            style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!canAdd || adding}
            activeOpacity={0.85}
          >
            <Text style={[styles.addButtonText, !canAdd && styles.addButtonTextDisabled]}>
              {adding ? 'Adding…' : 'Add Side Quest'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* ── Side quest list ───────────────────────────────────────────── */}
        <View style={styles.listArea}>
          {sideQuests.length === 0 ? (
            <Text style={styles.emptyText}>
              Nothing here yet. Add your first side quest above.
            </Text>
          ) : (
            sideQuests.map((sq) => (
              <SideQuestCard
                key={sq.id}
                sq={sq}
                isExpanded={expandedId === sq.id}
                draft={draft}
                isSaving={editSaving}
                onTap={() => handleToggle(sq)}
                onDelete={() => handleDelete(sq.id)}
                onDraftChange={setDraft}
                onSave={handleSave}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.Bg },
  scrollContent: { paddingBottom: 48 },

  // ── Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  screenTitle: { fontSize: 22, fontWeight: '700', color: C.TextPrimary },

  // ── Add area
  addArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
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

  // ── Duration pills
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

  // ── Link input
  linkInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.Surface,
    borderWidth: 1,
    borderColor: C.Border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  linkInputWrapFocused: { borderColor: C.Accent },
  linkIcon: { marginRight: 8 },
  linkInputField: {
    flex: 1,
    fontSize: 15,
    color: C.TextPrimary,
  },

  // ── Add button
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

  // ── List area
  listArea: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  emptyText: {
    fontSize: 15,
    color: C.TextSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Card shared
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardText: { flex: 1, marginRight: 8 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sqName: { fontSize: 17, fontWeight: '600', color: C.TextPrimary, marginBottom: 4 },
  sqDuration: { fontSize: 13, color: C.TextSecondary },
  linkIconBtn: { padding: 4 },
  trashWrap: { padding: 4 },

  // ── Expanded header
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
  cardNativeStandalone: {
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Edit form
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
