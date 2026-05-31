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
import Svg, { Path } from 'react-native-svg';
import { supabase } from '../../src/db/supabase';
import {
  getSideQuestsByUser,
  insertSideQuest,
  updateSideQuest,
  deleteSideQuest,
} from '../../src/db/dao';
import type { SideQuest } from '../../src/types';
import {
  AddInput,
  Colors,
  Chip,
  FieldInput,
  ItemMeta,
} from '../../src/components/ui';

const DURATION_OPTIONS = [3, 5, 10, 15] as const;
type DurationOption = (typeof DURATION_OPTIONS)[number];

const SWIPE_WIDTH = 72;

// React Native Web supports onMouseEnter/onMouseLeave on View but they are not
// typed in base @types/react-native. This typed wrapper avoids `any`.
type WebHoverExtras = { onMouseEnter?: () => void; onMouseLeave?: () => void };
const HoverableView = View as React.ComponentType<ViewProps & WebHoverExtras>;

function TrashIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 -960 960 960">
      <Path d="M313.5-177q-23.97 0-40.73-16.77Q256-210.53 256-234.5v-484h-39.5v-25.33H361V-771h238.5v27H744v25.5h-39.5v484.23q0 24.21-16.53 40.74T647-177H313.5ZM679-718.5H281.5v484q0 14 9 23t23 9H647q12 0 22-10t10-22v-484ZM404.5-282H430v-357.5h-25.5V-282Zm126 0H556v-357.5h-25.5V-282Zm-249-436.5v516-516Z" fill={color} />
    </Svg>
  );
}

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
        <Chip
          key={d}
          label={`${d}m`}
          selected={selected === d}
          onPress={() => onSelect(d)}
        />
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
      <Feather name="link" size={16} color={Colors.textDisabled} style={styles.linkIcon} />
      <TextInput
        style={styles.linkInputField}
        value={value}
        onChangeText={onChangeText}
        placeholder="Optional link (YouTube, article…)"
        placeholderTextColor={Colors.textDisabled}
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
  const [linkFocused, setLinkFocused] = useState(false);
  const canSave = draft.title.trim().length > 0 && draft.duration !== null;

  return (
    <View style={styles.editForm}>
      <FieldInput
        value={draft.title}
        onChangeText={(v) => onChange({ ...draft, title: v })}
        placeholder="Side quest title"
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

      <FieldInput
        value={draft.notes}
        onChangeText={(v) => onChange({ ...draft, notes: v })}
        placeholder="Notes…"
        multiline
        numberOfLines={3}
        style={styles.editNotesInput}
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
  const showIcons = hovered && !isExpanded;

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
      <Feather name="chevron-up" size={16} color={Colors.textSecondary} />
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
        style={styles.sqRow}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <TouchableOpacity onPress={onTap} style={styles.sqRowTapArea} activeOpacity={0.8}>
          <Text style={styles.sqName}>{sq.title}</Text>
        </TouchableOpacity>
        <View style={styles.rightSlot}>
          <View style={{ opacity: showIcons ? 0 : 1 }}>
            <ItemMeta>{`${sq.duration_minutes}m`}</ItemMeta>
          </View>
          <View style={[styles.iconsRow, { opacity: showIcons ? 1 : 0 }]}>
            {sq.link ? (
              <TouchableOpacity
                onPress={openLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name="external-link" size={16} color={Colors.accent} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <TrashIcon color={Colors.destructive} size={16} />
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
          <TrashIcon color="#fff" size={20} />
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
              <ItemMeta>{`${sq.duration_minutes}m`}</ItemMeta>
            </View>
            {sq.link ? (
              <TouchableOpacity
                onPress={openLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.linkIconBtn}
              >
                <Feather name="external-link" size={16} color={Colors.accent} />
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
          <AddInput
            value={title}
            onChangeText={setTitle}
            onSubmit={handleAdd}
            placeholder="e.g. Drink a glass of water"
            submitting={adding}
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
  root: { flex: 1, backgroundColor: Colors.bg },
  scrollContent: { paddingBottom: 48 },

  // ── Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  screenTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },

  // ── Add area
  addArea: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12,
  },
  // ── Duration pills
  pillsScroll: { flexGrow: 0 },
  pillsRow: { flexDirection: 'row', gap: 8 },

  // ── Link input
  linkInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderWarm,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  linkInputWrapFocused: { borderColor: Colors.accent },
  linkIcon: { marginRight: 8 },
  linkInputField: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    // @ts-ignore — web-only: suppress browser default focus outline
    outlineWidth: 0,
  },

  divider: { height: 1, backgroundColor: Colors.borderSubtle },

  // ── List area
  listArea: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // ── Card shared
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardText: { flex: 1, marginRight: 8 },
  sqName: { fontSize: 16, fontWeight: '400', color: Colors.taskName },
  linkIconBtn: { padding: 4 },

  // ── Flat row (web, matches tasks golden standard)
  sqRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
  sqRowTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  rightSlot: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 20,
  },
  iconsRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Expanded header
  expandedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  // ── Web expanded card
  cardWeb: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
    paddingVertical: 16,
    backgroundColor: 'transparent',
  },

  // ── Native cards
  cardWrapperNative: {
    position: 'relative',
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: Colors.destructive,
    overflow: 'hidden',
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  cardNativeStandalone: { marginBottom: 12 },

  // ── Edit form
  editForm: { gap: 10 },
  editNotesInput: { minHeight: 72, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  editSaveBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 28,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSaveBtnDisabled: { backgroundColor: Colors.borderWarm },
  editSaveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  editSaveBtnTextDisabled: { color: Colors.textDisabled },
  editCancelBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 28,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCancelBtnText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
