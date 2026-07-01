import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';

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
  const initial = route.params?.note || {};
  const convId = route.params?.convId ?? initial.conversation_id;

  const [note, setNote] = useState(initial);
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState(initial.body || '');
  const [newItem, setNewItem] = useState('');
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
  const saveItem = async (it, text) => {
    const t = text.trim();
    if (!t || t === it.text) return;
    try { setNote(await chat.updateTodo(note.id, it.id, t)); } catch {}
  };
  const removeItem = async (it) => {
    try { setNote(await chat.deleteTodo(note.id, it.id)); } catch {}
  };

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
            {todos.map((it) => (
              <View key={it.id} style={styles.todoRow}>
                <TouchableOpacity onPress={() => toggleItem(it)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name={it.done ? 'check-square' : 'square'} size={20} color={it.done ? '#f59e0b' : c.muted} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <TextInput
                    defaultValue={it.text}
                    onEndEditing={(e) => saveItem(it, e.nativeEvent.text)}
                    style={[styles.todoInput, { color: it.done ? c.muted : c.text }, it.done && styles.todoDone]}
                    placeholderTextColor={c.muted}
                  />
                  {it.done && it.done_by_name ? <Text style={styles.todoBy}>✓ afgestreept door {it.done_by_name}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => removeItem(it)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Feather name="x" size={16} color={c.muted} />
                </TouchableOpacity>
              </View>
            ))}
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
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  todoInput: { fontSize: 15, paddingVertical: 4 },
  todoDone: { textDecorationLine: 'line-through' },
  todoBy: { fontSize: 11, color: '#b45309', marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9, minWidth: 92, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  delText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
});
