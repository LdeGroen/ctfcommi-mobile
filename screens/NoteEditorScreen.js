import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Modal, Pressable,
  KeyboardAvoidingView, Alert, ActivityIndicator, useColorScheme,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import Avatar from '../src/Avatar';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';
import { useKeyboardOverlap } from '../src/useKeyboardOverlap';

function fmtDue(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
}
function isOverdue(iso) {
  if (!iso) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00') <= t;
}
function isoPlus(days) {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  card: dark ? '#111827' : '#f9fafb',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Bewerk één gedeelde notitie (bericht van soort 'note'). Kan een gewone notitie
// of een to-do-lijst zijn. Iedereen in het gesprek mag bewerken (laatste-opslag-
// wint voor titel/tekst; to-do-items zijn server-authoritatief per actie).
export default function NoteEditorScreen({ route, navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const headerHeight = useHeaderHeight();
  const { ref: kbRef, overlap: kbOverlap } = useKeyboardOverlap();
  const initial = route.params?.note || {};
  const convId = route.params?.convId ?? initial.conversation_id;
  const members = route.params?.members || [];

  const [note, setNote] = useState(initial);
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState(initial.body || '');
  const [newItem, setNewItem] = useState('');
  const [subText, setSubText] = useState('');
  const [addingSubFor, setAddingSubFor] = useState(null);
  const [assignForId, setAssignForId] = useState(null);
  const [dueForId, setDueForId] = useState(null);
  const [manualDue, setManualDue] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [external, setExternal] = useState(null);
  const subRef = useRef(null);

  const pinned = !!note.pinned_at;
  const isTodo = note.note_type === 'todo';
  const todos = note.todos || [];

  // Realtime: bericht-updates op dit gesprek volgen (ChatScreen deelt dit channel).
  useEffect(() => {
    let active = true;
    (async () => {
      const echo = await getEcho();
      if (!echo || !active || !convId) return;
      const channel = echo.private(`conversation.${convId}`);
      const onUpdated = (p) => {
        if (p.message?.id !== note.id) return;
        setNote(p.message); // to-do-items live bijwerken
        // Titel/tekst kunnen door een ander gewijzigd zijn → hint (niet klobberen).
        if ((p.message.title || '') !== title || (p.message.body || '') !== body) {
          setExternal({ name: p.message.user?.name, msg: p.message });
        }
      };
      const onDeleted = (p) => { if (p.message?.id === note.id) navigation.goBack(); };
      channel.listen('.chat.message.updated', onUpdated);
      channel.listen('.chat.message.deleted', onDeleted);
      subRef.current = { channel, onUpdated, onDeleted };
    })();
    return () => {
      const r = subRef.current;
      active = false;
      if (r) {
        try {
          r.channel.stopListening('.chat.message.updated', r.onUpdated);
          r.channel.stopListening('.chat.message.deleted', r.onDeleted);
        } catch {}
      }
    };
  }, [convId, note.id, navigation, title, body]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isTodo ? 'To-do' : 'Notitie',
      headerRight: () => (
        <TouchableOpacity onPress={togglePin} disabled={pinning} style={{ paddingHorizontal: 8 }}>
          <Feather name="bookmark" size={20} color={pinned ? '#f59e0b' : '#fff'} />
        </TouchableOpacity>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, pinned, pinning, isTodo]);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await chat.updateNote(note.id, { title: title.trim(), body });
      setNote(updated);
      setExternal(null);
    } catch (e) { Alert.alert('Opslaan mislukt', e.message || ''); }
    finally { setSaving(false); }
  };

  const setType = async (type) => {
    if ((note.note_type || 'note') === type) return;
    try { setNote(await chat.updateNote(note.id, { title: title.trim(), body, noteType: type })); }
    catch (e) { Alert.alert('Wijzigen mislukt', e.message || ''); }
  };

  const togglePin = async () => {
    setPinning(true);
    try { setNote(await chat.togglePinNote(note.id)); }
    catch (e) { Alert.alert('Vastprikken mislukt', e.message || ''); }
    finally { setPinning(false); }
  };

  const addItem = async () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem('');
    try { setNote(await chat.addTodo(note.id, text)); }
    catch (e) { Alert.alert('Toevoegen mislukt', e.message || ''); }
  };
  const toggleItem = async (it) => {
    try { setNote(await chat.toggleTodo(note.id, it.id)); } catch {}
  };
  const moveItem = async (it, dir) => {
    try { setNote(await chat.moveTodo(note.id, it.id, dir)); } catch {}
  };
  const addSub = async (parentId) => {
    const t = subText.trim();
    if (!t) { setAddingSubFor(null); return; }
    setSubText(''); setAddingSubFor(null);
    try { setNote(await chat.addTodo(note.id, t, parentId)); }
    catch (e) { Alert.alert('Toevoegen mislukt', e.message || ''); }
  };
  const saveItem = async (it, text) => {
    const t = text.trim();
    if (!t || t === it.text) return;
    try { setNote(await chat.updateTodo(note.id, it.id, t)); } catch {}
  };
  const removeItem = async (it) => {
    try { setNote(await chat.deleteTodo(note.id, it.id)); } catch {}
  };
  const assignItem = async (itemId, userIds) => {
    try { setNote(await chat.assignTodo(note.id, itemId, userIds)); } catch (e) { Alert.alert('Toewijzen mislukt', e.message || ''); }
  };
  const setDueItem = async (itemId, dueOn) => {
    setDueForId(null); setManualDue('');
    try { setNote(await chat.setTodoDue(note.id, itemId, dueOn || null)); } catch (e) { Alert.alert('Deadline mislukt', e.message || ''); }
  };
  const setRecurItem = async (itemId, recurrence) => {
    try { setNote(await chat.setTodoRecurrence(note.id, itemId, recurrence)); } catch (e) { Alert.alert('Herhaling mislukt', e.message || ''); }
  };

  const assignItemObj = todos.find((t) => t.id === assignForId);
  const dueItemObj = todos.find((t) => t.id === dueForId);

  const del = () => {
    Alert.alert('Notitie verwijderen', 'Deze notitie verwijderen voor iedereen in dit gesprek?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen', style: 'destructive', onPress: async () => {
          try { await chat.deleteMessage(note.id); navigation.goBack(); }
          catch (e) { Alert.alert('Verwijderen mislukt', e.message || ''); }
        },
      },
    ]);
  };

  const reloadExternal = () => {
    if (!external?.msg) return;
    setTitle(external.msg.title || '');
    setBody(external.msg.body || '');
    setExternal(null);
  };

  return (
    <KeyboardAvoidingView ref={kbRef} style={{ flex: 1, backgroundColor: c.bg, paddingBottom: kbOverlap }}>
      <View style={{ flex: 1, padding: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={save}
          placeholder="Titel"
          placeholderTextColor={c.muted}
          style={[styles.titleInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />

        {/* Type-schakelaar */}
        <View style={[styles.segment, { borderColor: c.border, backgroundColor: c.card }]}>
          {[['note', 'Notitie', 'file-text'], ['todo', 'To-do', 'check-square']].map(([val, label, icon]) => {
            const active = (note.note_type || 'note') === val;
            return (
              <TouchableOpacity key={val} onPress={() => setType(val)} style={[styles.segBtn, active && styles.segBtnActive]}>
                <Feather name={icon} size={14} color={active ? '#fff' : c.muted} />
                <Text style={[styles.segText, { color: active ? '#fff' : c.muted }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {external && (
          <View style={styles.externalBar}>
            <Text style={{ color: '#92400e', flex: 1, fontSize: 13 }}>Bijgewerkt door {external.name || 'iemand'}.</Text>
            <TouchableOpacity onPress={reloadExternal}><Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>Herladen</Text></TouchableOpacity>
          </View>
        )}

        {isTodo ? (
          <ScrollView style={{ flex: 1, marginTop: 10 }} keyboardShouldPersistTaps="handled">
            {todos.filter((t) => !t.parent_id).sort((a, b) => a.position - b.position).map((top, ti, arr) => {
              const kids = todos.filter((t) => t.parent_id === top.id).sort((a, b) => a.position - b.position);
              const rows = [{ it: top, isChild: false, isFirst: ti === 0, isLast: ti === arr.length - 1 }];
              kids.forEach((ch, ki) => rows.push({ it: ch, isChild: true, isFirst: ki === 0, isLast: ki === kids.length - 1 }));
              return (
                <View key={top.id}>
                  {rows.map(({ it, isChild, isFirst, isLast }) => (
                    <View key={it.id} style={[styles.todoItem, isChild && styles.todoChild]}>
                      <View style={styles.todoRow}>
                        <TouchableOpacity onPress={() => toggleItem(it)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                          <Feather name={it.done ? 'check-square' : 'square'} size={20} color={it.done ? '#f59e0b' : c.muted} />
                        </TouchableOpacity>
                        <TextInput
                          defaultValue={it.text}
                          onEndEditing={(e) => saveItem(it, e.nativeEvent.text)}
                          style={[styles.todoInput, { flex: 1, color: it.done ? c.muted : c.text }, it.done && styles.todoDone]}
                          placeholderTextColor={c.muted}
                        />
                        <TouchableOpacity onPress={() => setAssignForId(it.id)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                          <Feather name="users" size={16} color={c.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setDueForId(it.id); setManualDue(it.due_on || ''); }} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                          <Feather name="calendar" size={16} color={c.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveItem(it, 'up')} disabled={isFirst} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} style={isFirst && { opacity: 0.25 }}>
                          <Feather name="chevron-up" size={18} color={c.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => moveItem(it, 'down')} disabled={isLast} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }} style={isLast && { opacity: 0.25 }}>
                          <Feather name="chevron-down" size={18} color={c.muted} />
                        </TouchableOpacity>
                        {!isChild && (
                          <TouchableOpacity onPress={() => { setAddingSubFor(top.id); setSubText(''); }} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                            <Feather name="corner-down-right" size={16} color={c.muted} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => removeItem(it)} hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}>
                          <Feather name="x" size={16} color={c.muted} />
                        </TouchableOpacity>
                      </View>
                      {(it.due_on || it.recurrence || (it.assignees || []).length > 0 || (it.done && it.done_by_name)) && (
                        <View style={styles.todoMeta}>
                          {it.due_on ? <Text style={[styles.dueBadge, !it.done && isOverdue(it.due_on) ? styles.dueOverdue : styles.dueNormal]}>{fmtDue(it.due_on)}</Text> : null}
                          {it.recurrence ? <Feather name="repeat" size={12} color="#b45309" /> : null}
                          {(it.assignees || []).slice(0, 4).map((a) => (
                            <View key={a.id} style={styles.avatarWrap}><Avatar name={a.name} uri={a.avatar} size={20} /></View>
                          ))}
                          {it.done && it.done_by_name ? <Text style={styles.todoBy}>✓ {it.done_by_name}</Text> : null}
                        </View>
                      )}
                    </View>
                  ))}
                  {addingSubFor === top.id && (
                    <View style={[styles.todoRow, styles.todoChild]}>
                      <Feather name="corner-down-right" size={16} color="#f59e0b" />
                      <TextInput
                        autoFocus
                        value={subText}
                        onChangeText={setSubText}
                        onSubmitEditing={() => addSub(top.id)}
                        onBlur={() => addSub(top.id)}
                        blurOnSubmit={false}
                        returnKeyType="done"
                        placeholder="Subitem…"
                        placeholderTextColor={c.muted}
                        style={[styles.todoInput, { color: c.text, flex: 1 }]}
                      />
                    </View>
                  )}
                </View>
              );
            })}
            <View style={styles.todoRow}>
              <Feather name="plus" size={18} color="#f59e0b" />
              <TextInput
                value={newItem}
                onChangeText={setNewItem}
                onSubmitEditing={addItem}
                blurOnSubmit={false}
                returnKeyType="done"
                placeholder="Item toevoegen…"
                placeholderTextColor={c.muted}
                style={[styles.todoInput, { color: c.text, flex: 1 }]}
              />
            </View>
          </ScrollView>
        ) : (
          <>
            <View style={styles.toolbar}>
              <TouchableOpacity onPress={() => setPreview((v) => !v)} style={styles.toggle}>
                <Feather name={preview ? 'edit-2' : 'eye'} size={14} color="#6366f1" />
                <Text style={styles.toggleText}>{preview ? 'Bewerken' : 'Voorbeeld'}</Text>
              </TouchableOpacity>
              {pinned && <Text style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 12, fontWeight: '600' }}>Vastgeprikt</Text>}
            </View>
            {preview ? (
              <View style={[styles.body, { borderColor: c.border, backgroundColor: c.card }]}>
                <Markdown style={{ body: { color: c.text, fontSize: 15 }, link: { color: '#6366f1' } }}>{body || '_Leeg_'}</Markdown>
              </View>
            ) : (
              <TextInput
                value={body}
                onChangeText={setBody}
                onBlur={save}
                placeholder="Schrijf samen… (Markdown: **vet**, - lijst, # kop)"
                placeholderTextColor={c.muted}
                multiline
                textAlignVertical="top"
                style={[styles.body, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
              />
            )}
          </>
        )}

        <View style={styles.actions}>
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Opslaan</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={del} style={styles.delBtn}>
            <Feather name="trash-2" size={14} color="#dc2626" />
            <Text style={styles.delText}>Verwijderen</Text>
          </TouchableOpacity>
          <Text style={{ marginLeft: 'auto', color: c.muted, fontSize: 12 }}>{note.edited_at ? 'bewerkt ' : ''}{fmt(note.edited_at || note.created_at)}</Text>
        </View>
      </View>

      {/* Toewijs-modal */}
      <Modal visible={!!assignForId} transparent animationType="fade" onRequestClose={() => setAssignForId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setAssignForId(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Toewijzen aan</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {members.length === 0 && <Text style={{ color: c.muted, padding: 12 }}>Geen leden.</Text>}
              {members.map((m) => {
                const uid = m.user_id ?? m.id;
                const cur = (assignItemObj?.assignees || []).map((a) => a.id);
                const on = cur.includes(uid);
                return (
                  <TouchableOpacity key={uid} style={styles.memberRow}
                    onPress={() => assignItemObj && assignItem(assignItemObj.id, on ? cur.filter((x) => x !== uid) : [...cur, uid])}>
                    <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? '#f59e0b' : c.muted} />
                    <Avatar name={m.name} uri={m.avatar} size={26} />
                    <Text style={{ color: c.text, fontSize: 15, flex: 1 }} numberOfLines={1}>{m.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity onPress={() => setAssignForId(null)} style={styles.modalDone}><Text style={styles.modalDoneText}>Klaar</Text></TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Deadline-modal */}
      <Modal visible={!!dueForId} transparent animationType="fade" onRequestClose={() => setDueForId(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDueForId(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Deadline</Text>
            {[['Vandaag', isoPlus(0)], ['Morgen', isoPlus(1)], ['Over 1 week', isoPlus(7)]].map(([label, val]) => (
              <TouchableOpacity key={label} style={styles.memberRow} onPress={() => setDueItem(dueForId, val)}>
                <Feather name="calendar" size={16} color="#f59e0b" />
                <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{label}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{fmtDue(val)}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.manualRow}>
              <TextInput value={manualDue} onChangeText={setManualDue} placeholder="JJJJ-MM-DD" placeholderTextColor={c.muted}
                         style={[styles.todoInput, { flex: 1, color: c.text, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10 }]} />
              <TouchableOpacity onPress={() => /^\d{4}-\d{2}-\d{2}$/.test(manualDue) && setDueItem(dueForId, manualDue)} style={styles.modalDone}>
                <Text style={styles.modalDoneText}>Zet</Text>
              </TouchableOpacity>
            </View>
            {dueItemObj?.due_on ? (
              <TouchableOpacity onPress={() => setDueItem(dueForId, null)} style={styles.clearDue}>
                <Feather name="x" size={14} color="#dc2626" /><Text style={{ color: '#dc2626', fontSize: 14 }}>Deadline wissen</Text>
              </TouchableOpacity>
            ) : null}

            <Text style={[styles.modalTitle, { color: c.text, fontSize: 14, marginTop: 14 }]}>Herhaling</Text>
            {[['Geen', null], ['Elke week', 'weekly'], ['Elke maand', 'monthly']].map(([label, val]) => {
              const on = (dueItemObj?.recurrence || null) === val;
              return (
                <TouchableOpacity key={label} style={styles.memberRow} onPress={() => setRecurItem(dueForId, val)}>
                  <Feather name={on ? 'check-circle' : 'circle'} size={16} color={on ? '#f59e0b' : c.muted} />
                  <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{label}</Text>
                  {val ? <Feather name="repeat" size={14} color={c.muted} /> : null}
                </TouchableOpacity>
              );
            })}
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Bij een terugkerende taak schuift de deadline na afvinken automatisch naar de volgende keer.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  titleInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '600' },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 3, marginTop: 8, gap: 3 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 7, borderRadius: 7 },
  segBtnActive: { backgroundColor: '#6366f1' },
  segText: { fontSize: 13, fontWeight: '600' },
  externalBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 15 },
  todoItem: { paddingVertical: 2 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  todoChild: { marginLeft: 24 },
  todoMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 28, marginTop: -2, marginBottom: 2 },
  dueBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  dueNormal: { backgroundColor: '#fef3c7', color: '#b45309' },
  dueOverdue: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  avatarWrap: { marginLeft: -4 },
  todoInput: { fontSize: 15, paddingVertical: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  modalDone: { backgroundColor: '#6366f1', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  modalDoneText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  clearDue: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 10 },
  todoDone: { textDecorationLine: 'line-through' },
  todoBy: { fontSize: 11, color: '#b45309', marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9, minWidth: 92, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  delText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
});
