import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
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

// Gedeelde notities per gesprek. Iedereen in het gesprek kan meerdere notities
// aanmaken en bewerken (laatste-opslag-wint). Realtime via het conversation-channel;
// ChatScreen deelt datzelfde channel, dus hier géén echo.leave — alleen onze eigen
// note-listeners opruimen.
export default function SharedNotesScreen({ route, navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const convId = route.params?.id;

  const [notes, setNotes] = useState(null);
  const [me, setMe] = useState(null);
  const [selected, setSelected] = useState(null); // volledige note die open is
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [external, setExternal] = useState(null); // { name } als iemand anders bijwerkte
  const subRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([chat.listNotes(convId), chat.me().catch(() => null)])
      .then(([res, meRes]) => { if (!cancelled) { setNotes(res.notes || []); setMe(meRes); } })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [convId]);

  // Realtime
  useEffect(() => {
    let active = true;
    (async () => {
      const echo = await getEcho();
      if (!echo || !active) return;
      const channel = echo.private(`conversation.${convId}`);
      const onCreated = (p) => setNotes((prev) => (prev || []).some((n) => n.id === p.note.id) ? prev : [p.note, ...(prev || [])]);
      const onUpdated = (p) => {
        setNotes((prev) => (prev || []).map((n) => (n.id === p.note.id ? p.note : n)));
        setSelected((sel) => {
          if (sel && sel.id === p.note.id && p.note.updated_by !== me?.id) setExternal({ name: p.note.updater_name, note: p.note });
          return sel;
        });
      };
      const onDeleted = (p) => {
        setNotes((prev) => (prev || []).filter((n) => n.id !== p.note.id));
        setSelected((sel) => (sel && sel.id === p.note.id ? null : sel));
      };
      channel.listen('.chat.note.created', onCreated);
      channel.listen('.chat.note.updated', onUpdated);
      channel.listen('.chat.note.deleted', onDeleted);
      subRef.current = { channel, onCreated, onUpdated, onDeleted };
    })();
    return () => {
      active = false;
      const r = subRef.current;
      if (r) {
        try {
          r.channel.stopListening('.chat.note.created', r.onCreated);
          r.channel.stopListening('.chat.note.updated', r.onUpdated);
          r.channel.stopListening('.chat.note.deleted', r.onDeleted);
        } catch {}
      }
    };
  }, [convId, me?.id]);

  // Kop toont terug-knop wanneer een notitie open is.
  useEffect(() => {
    navigation.setOptions({
      title: selected ? 'Notitie' : 'Gedeelde notities',
      headerLeft: selected ? () => (
        <TouchableOpacity onPress={() => setSelected(null)} style={{ paddingHorizontal: 8 }}>
          <Feather name="chevron-left" size={26} color="#6366f1" />
        </TouchableOpacity>
      ) : undefined,
    });
  }, [selected, navigation]);

  const openNote = (n) => {
    setSelected(n);
    setTitle(n.title || '');
    setBody(n.body || '');
    setPreview(false);
    setExternal(null);
  };

  const newNote = async () => {
    setSaving(true);
    try {
      const n = await chat.createNote(convId, { title: '', body: '' });
      setNotes((prev) => (prev || []).some((x) => x.id === n.id) ? prev : [n, ...(prev || [])]);
      openNote(n);
    } catch (e) { Alert.alert('Aanmaken mislukt', e.message || ''); }
    finally { setSaving(false); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const n = await chat.updateNote(selected.id, { title: title.trim(), body });
      setNotes((prev) => (prev || []).map((x) => (x.id === n.id ? n : x)));
      setSelected(n);
      setExternal(null);
    } catch (e) { Alert.alert('Opslaan mislukt', e.message || ''); }
    finally { setSaving(false); }
  };

  const del = () => {
    if (!selected) return;
    Alert.alert('Notitie verwijderen', 'Deze notitie verwijderen voor iedereen in dit gesprek?', [
      { text: 'Annuleren', style: 'cancel' },
      {
        text: 'Verwijderen', style: 'destructive', onPress: async () => {
          try {
            await chat.deleteNote(selected.id);
            setNotes((prev) => (prev || []).filter((x) => x.id !== selected.id));
            setSelected(null);
          } catch (e) { Alert.alert('Verwijderen mislukt', e.message || ''); }
        },
      },
    ]);
  };

  const reloadExternal = () => {
    if (!external?.note) return;
    setTitle(external.note.title || '');
    setBody(external.note.body || '');
    setExternal(null);
  };

  // --- Lijstweergave ---
  if (!selected) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <FlatList
          data={notes || []}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 12 }}
          ListHeaderComponent={
            <TouchableOpacity onPress={newNote} disabled={saving} style={styles.newBtn}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.newBtnText}>Nieuwe notitie</Text>
            </TouchableOpacity>
          }
          ListEmptyComponent={
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>
              {notes === null ? 'Laden…' : 'Nog geen notities. Maak er samen één!'}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openNote(item)} style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>{item.title || 'Naamloze notitie'}</Text>
              <Text style={[styles.cardMeta, { color: c.muted }]} numberOfLines={1}>
                bewerkt {fmt(item.updated_at)}{item.updater_name ? ` · ${item.updater_name}` : ''}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  // --- Detail/bewerken ---
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, padding: 12 }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Titel"
          placeholderTextColor={c.muted}
          style={[styles.titleInput, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
        />

        {external && (
          <View style={styles.externalBar}>
            <Text style={{ color: '#92400e', flex: 1, fontSize: 13 }}>Bijgewerkt door {external.name || 'iemand'}.</Text>
            <TouchableOpacity onPress={reloadExternal}><Text style={{ color: '#92400e', fontWeight: '700', fontSize: 13 }}>Herladen</Text></TouchableOpacity>
          </View>
        )}

        <View style={styles.toolbar}>
          <TouchableOpacity onPress={() => setPreview((v) => !v)} style={styles.toggle}>
            <Feather name={preview ? 'edit-2' : 'eye'} size={14} color="#6366f1" />
            <Text style={styles.toggleText}>{preview ? 'Bewerken' : 'Voorbeeld'}</Text>
          </TouchableOpacity>
        </View>

        {preview ? (
          <View style={[styles.body, { borderColor: c.border, backgroundColor: c.card }]}>
            <Markdown style={{ body: { color: c.text, fontSize: 15 }, link: { color: '#6366f1' } }}>{body || '_Leeg_'}</Markdown>
          </View>
        ) : (
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Schrijf samen… (Markdown: **vet**, - lijst, # kop)"
            placeholderTextColor={c.muted}
            multiline
            textAlignVertical="top"
            style={[styles.body, { color: c.text, borderColor: c.border, backgroundColor: c.card }]}
          />
        )}

        <View style={styles.actions}>
          <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveText}>Opslaan</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={del} style={styles.delBtn}>
            <Feather name="trash-2" size={14} color="#dc2626" />
            <Text style={styles.delText}>Verwijderen</Text>
          </TouchableOpacity>
          <Text style={{ marginLeft: 'auto', color: c.muted, fontSize: 12 }}>bewerkt {fmt(selected.updated_at)}</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 11, marginBottom: 12 },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 3 },
  titleInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '600' },
  externalBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef3c7', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  toggleText: { color: '#6366f1', fontSize: 13, fontWeight: '600' },
  body: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 15 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12 },
  saveBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 9, minWidth: 92, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  delBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  delText: { color: '#dc2626', fontSize: 14, fontWeight: '500' },
});
