import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, StyleSheet, useColorScheme, Alert, Modal, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import Avatar from '../src/Avatar';
import { useHeaderHeight } from '@react-navigation/elements';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';
import { shareFromDrive } from '../src/drive';
import { convertEmoticons } from '../src/emoticons';
import MessageView, { theme } from '../src/MessageView';
import { useBottomBarInset } from '../src/useBottomBarInset';
import KeyboardScreen from '../src/KeyboardScreen';
import PersonCard from '../src/PersonCard';

export default function ChatScreen({ route, navigation }) {
  const bottomInset = useBottomBarInset();
  const { id } = route.params;
  const dark = useColorScheme() === 'dark';
  const c = useMemo(() => theme(dark), [dark]);
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [mentionItems, setMentionItems] = useState([]);
  const [me, setMe] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [conv, setConv] = useState(null);
  const [announce, setAnnounce] = useState(false);
  const [remindFor, setRemindFor] = useState(null);
  const [readsModal, setReadsModal] = useState(null);
  const [profielId, setProfielId] = useState(null); // open profielkaartje
  const subRef = useRef(null);
  const draftTimer = useRef(null);

  const markRead = (lastId) => chat.markRead(id, lastId).catch(() => {});

  // Ook bij terugkeren in dit scherm (uit een thread, of vanuit de achtergrond)
  // opnieuw als gelezen melden — er kan intussen van alles zijn binnengekomen.
  useFocusEffect(useCallback(() => { markRead(); }, [id]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <TouchableOpacity onPress={() => navigation.navigate('SharedFiles', { id, title: route.params?.title })}>
            <Feather name="paperclip" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Search', { conversationId: id, conversationName: route.params?.title })}>
            <Feather name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, id, route.params?.title]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [res, det, meRes] = await Promise.all([chat.listMessages(id, { limit: 40 }), chat.getConversation(id), chat.me().catch(() => null)]);
        if (cancelled) return;
        // Vastgeprikte notities kunnen ouder zijn dan het venster: erbij mengen.
        const base = res.messages || [];
        const have = new Set(base.map((m) => m.id));
        const msgs = [...(det?.pinned_notes || []).filter((n) => !have.has(n.id)), ...base].sort((a, b) => a.id - b.id);
        setMessages(msgs);
        setMembers(det?.members || []);
        setConv(det || null);
        if (meRes) setMe(meRes);
        if (det?.draft) setText(det.draft); // concept van een ander apparaat
        // Zonder id: de server neemt het hoogste bericht van dit gesprek.
        // Met het laatst geladen bericht bleef de teller staan zodra er nog een
        // nieuwer thread-antwoord was — die staan niet in deze lijst, maar
        // tellen wel mee in het aantal ongelezen.
        markRead();
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      const echo = await getEcho();
      if (!echo || !active) return;
      const channel = echo.private(`conversation.${id}`);
      const onCreated = (p) => { const m = p.message; if (m.parent_id) return; setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])); markRead(m.id); };
      // is_saved uit de eigen weergave overnemen: een uitzending gaat naar
      // iedereen tegelijk en weet dus niet wie wat bewaard heeft.
      const onUpdated = (p) => { const m = p.message; setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...(m.body_truncated ? { ...m, body: x.body } : m), is_saved: x.is_saved } : x))); };
      const onDeleted = (p) => setMessages((prev) => prev.map((x) => (x.id === p.message.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
      channel.listen('.chat.message.created', onCreated);
      channel.listen('.chat.message.updated', onUpdated);
      channel.listen('.chat.message.deleted', onDeleted);
      subRef.current = { channel, echo, onCreated, onUpdated, onDeleted };
    })();
    return () => {
      active = false;
      const r = subRef.current;
      if (r) {
        try {
          r.channel.stopListening('.chat.message.created', r.onCreated);
          r.channel.stopListening('.chat.message.updated', r.onUpdated);
          r.channel.stopListening('.chat.message.deleted', r.onDeleted);
          r.echo.leave(`conversation.${id}`);
        } catch {}
      }
    };
  }, [id]);

  const onChangeText = (raw) => {
    const t = convertEmoticons(raw);
    setText(t);
    // @-suggesties tonen wanneer je een naam aan het typen bent na een @.
    const m = t.match(/(?:^|\s)@([\w-]*)$/);
    if (m) {
      const q = m[1].toLowerCase();
      const list = members.filter((mm) => (mm.name || '').toLowerCase().includes(q)).slice(0, 6);
      if ('channel'.includes(q) || 'iedereen'.includes(q)) list.unshift({ name: 'channel', _channel: true });
      setMentionItems(list);
    } else {
      setMentionItems([]);
    }
    // Concept gedebounced naar de server (synct over apparaten) — niet tijdens
    // het bewerken van een bestaand bericht (dan is de tekst geen concept).
    if (!editingId) {
      clearTimeout(draftTimer.current);
      draftTimer.current = setTimeout(() => { chat.saveDraft(id, t).catch(() => {}); }, 800);
    }
  };

  const pickMention = (item) => {
    setText((prev) => prev.replace(/(^|\s)@([\w-]*)$/, (full, pre) => `${pre}@${item.name} `));
    setMentionItems([]);
  };

  const resolveMentionIds = (body) =>
    members.filter((mm) => mm.name && body.includes(`@${mm.name}`)).map((mm) => mm.user_id ?? mm.id);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const sent = await chat.sendMessage(id, { body, mentionUserIds: resolveMentionIds(body), isAnnouncement: announce });
      setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      setText('');
      setAnnounce(false);
      setMentionItems([]);
      clearTimeout(draftTimer.current);
      chat.saveDraft(id, '').catch(() => {});
    } catch {} finally { setSending(false); }
  };

  const [driveBusy, setDriveBusy] = useState(false);
  const shareDrive = async () => {
    if (driveBusy) return;
    setDriveBusy(true);
    try {
      const result = await shareFromDrive({ conversationId: id });
      if (result === 'shared') {
        // Nieuw bericht komt via realtime binnen; refresh als fallback.
        try {
          const res = await chat.listMessages(id, { limit: 40 });
          setMessages(res.messages || []);
        } catch {}
      }
    } catch {} finally { setDriveBusy(false); }
  };

  const handleReact = useCallback(async (msg, emoji) => {
    try {
      const updated = await chat.toggleReaction(msg.id, emoji);
      setMessages((prev) => prev.map((x) => (x.id === msg.id ? updated : x)));
    } catch {}
  }, []);

  const startEdit = useCallback((msg) => {
    setEditingId(msg.id);
    setText(msg.body || '');
    setMentionItems([]);
  }, []);

  const cancelEdit = () => { setEditingId(null); setText(''); };

  const saveEdit = async () => {
    const body = text.trim();
    if (!editingId || !body) return;
    setSending(true);
    try {
      const updated = await chat.editMessage(editingId, body, resolveMentionIds(body));
      setMessages((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
      setEditingId(null);
      setText('');
      setMentionItems([]);
    } catch {} finally { setSending(false); }
  };

  const handleDelete = useCallback((msg) => {
    Alert.alert('Bericht verwijderen', 'Weet je zeker dat je dit bericht wilt verwijderen?', [
      { text: 'Annuleren', style: 'cancel' },
      { text: 'Verwijderen', style: 'destructive', onPress: async () => {
        try { await chat.deleteMessage(msg.id); setMessages((prev) => prev.map((x) => (x.id === msg.id ? { ...x, deleted_at: new Date().toISOString() } : x))); } catch {}
      } },
    ]);
  }, []);

  const openThread = useCallback((item) => navigation.navigate('Thread', { convId: id, parentId: item.id, title: 'Thread' }), [id, navigation]);
  const openNote = useCallback((item) => navigation.navigate('NoteEditor', { note: item, convId: id, members }), [id, navigation, members]);
  const placeNote = useCallback(async (noteType) => {
    try { const note = await chat.placeNote(id, { noteType }); navigation.navigate('NoteEditor', { note, convId: id, members }); } catch {}
  }, [id, navigation, members]);
  const toggleTodo = useCallback(async (note, todoItem) => {
    try {
      const updated = await chat.toggleTodo(note.id, todoItem.id);
      setMessages((prev) => prev.map((x) => (x.id === note.id ? updated : x)));
    } catch {}
  }, []);

  const openRemind = useCallback((msg) => setRemindFor(msg), []);
  const saveForLater = useCallback(async (msg) => {
    try {
      const r = await chat.toggleSave(msg.id);
      // Ook het bericht in beeld bijwerken, anders blijft het icoon staan alsof
      // er niets gebeurd is en weet je bij de volgende keer openen niet meer
      // wat je bewaard had.
      setMessages((prev) => prev.map((x) => (x.id === msg.id ? { ...x, is_saved: r.saved } : x)));
      Alert.alert(r.saved ? 'Bewaard' : 'Verwijderd', r.saved ? 'Terug te vinden onder "Bewaren voor later".' : 'Uit je bewaarlijst gehaald.');
    } catch (e) { Alert.alert('Mislukt', e.message || ''); }
  }, []);
  const openReads = useCallback(async (msg) => {
    setReadsModal({ loading: true });
    try { const r = await chat.messageReads(msg.id); setReadsModal({ loading: false, ...r }); }
    catch { setReadsModal(null); }
  }, []);

  const fmtLocal = (d) => {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
  };
  const remindOptions = () => {
    const now = new Date();
    const inHour = new Date(now.getTime() + 3600 * 1000);
    const tonight = new Date(now); tonight.setHours(18, 0, 0, 0); if (tonight <= now) tonight.setDate(tonight.getDate() + 1);
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0);
    const week = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    return [
      ['Over 1 uur', inHour], ['Vanavond 18:00', tonight], ['Morgen 09:00', tomorrow], ['Volgende week', week],
    ];
  };
  const setReminder = async (when) => {
    const msg = remindFor; setRemindFor(null);
    if (!msg) return;
    try {
      await chat.addReminder({ messageId: msg.id, conversationId: id, remindAt: fmtLocal(when) });
      Alert.alert('Herinnering gezet', 'Je krijgt op dat moment een melding.');
    } catch (e) { Alert.alert('Mislukt', e.message || ''); }
  };

  const renderItem = useCallback(({ item }) => (
    <MessageView item={item} c={c} me={me} onOpenThread={openThread} onReact={handleReact} onEdit={startEdit} onDelete={handleDelete} onOpenNote={openNote} onToggleTodo={toggleTodo} onRemind={openRemind} onSave={saveForLater} onShowReads={openReads} onOpenProfile={setProfielId} />
  ), [c, me, openThread, handleReact, startEdit, handleDelete, openNote, toggleTodo, openRemind, saveForLater, openReads, setProfielId]);

  const pinnedNotes = messages.filter((m) => m.kind === 'note' && m.pinned_at && !m.deleted_at);
  // Vastgeprikte notities tonen we in de pinbalk; niet nóg eens in de stroom.
  const data = [...messages].filter((m) => !(m.kind === 'note' && m.pinned_at)).reverse(); // inverted: nieuwste onderaan

  // Sinds targetSdk 36 tekent Android edge-to-edge: het venster krimpt niet meer
  // voor het toetsenbord (adjustResize doet niets), dus we schuiven zelf omhoog met
  // 'padding' — op beide platforms. De onderste balk houdt daarnaast de
  // navigatiebalk-inset vrij via useBottomBarInset.
  return (
    <KeyboardScreen style={{ flex: 1, backgroundColor: c.bg }}>
      {pinnedNotes.length > 0 && (
        <View style={[styles.pinBar, { borderColor: c.noteBorder, backgroundColor: c.noteBg }]}>
          {pinnedNotes.map((n) => (
            <TouchableOpacity key={n.id} style={styles.pinChip} onPress={() => openNote(n)} activeOpacity={0.7}>
              <Feather name="bookmark" size={13} color="#f59e0b" />
              <Text style={{ color: c.text, fontSize: 13, flex: 1 }} numberOfLines={1}>{n.title || 'Notitie'}</Text>
              <Feather name="chevron-right" size={15} color={c.muted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
      <FlatList
        inverted
        data={data}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12 }}
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
      />
      {mentionItems.length > 0 && (
        <View style={[styles.mentionBox, { backgroundColor: c.bg, borderColor: c.border }]}>
          {mentionItems.map((item) => (
            <TouchableOpacity key={item._channel ? 'channel' : (item.user_id ?? item.id)} style={styles.mentionRow} onPress={() => pickMention(item)}>
              <View style={styles.mentionAvatar}><Text style={styles.mentionAvatarText}>{item._channel ? '#' : (item.name || '?').charAt(0).toUpperCase()}</Text></View>
              <Text style={[styles.mentionName, { color: c.text }]} numberOfLines={1}>@{item.name}</Text>
              {item._channel && <Text style={[styles.mentionHint, { color: c.muted }]}>iedereen</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}
      {editingId && (
        <View style={[styles.editBar, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Feather name="edit-2" size={14} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13, flex: 1 }} numberOfLines={1}>Bericht bewerken…</Text>
          <TouchableOpacity onPress={cancelEdit}><Text style={{ color: '#6366f1', fontSize: 13, fontWeight: '600' }}>Annuleren</Text></TouchableOpacity>
        </View>
      )}
      {conv && conv.can_post === false ? (
        <View style={[styles.blockedBar, { borderColor: c.border, backgroundColor: c.bg, paddingBottom: 14 + bottomInset }]}>
          <Feather name="volume-2" size={15} color={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13, flex: 1 }}>Aankondigingskanaal — alleen de beheerder kan hier berichten plaatsen.</Text>
        </View>
      ) : (
        <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg, paddingBottom: 8 + bottomInset }]}>
          {!editingId && (
            <>
              <TouchableOpacity style={[styles.drive, driveBusy && { opacity: 0.4 }]} onPress={shareDrive} disabled={driveBusy}>
                <Feather name="hard-drive" size={20} color={c.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.drive} onPress={() => placeNote('note')}>
                <Feather name="file-text" size={20} color={c.muted} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.drive} onPress={() => placeNote('todo')}>
                <Feather name="check-square" size={20} color={c.muted} />
              </TouchableOpacity>
              {/* Aankondiging (met leesbevestiging) — in een gewoon kanaal optioneel; in een aankondigingskanaal automatisch. */}
              {conv?.type === 'channel' && conv?.post_policy !== 'admins' && (
                <TouchableOpacity style={styles.drive} onPress={() => setAnnounce((v) => !v)}>
                  <Feather name="volume-2" size={20} color={announce ? '#f59e0b' : c.muted} />
                </TouchableOpacity>
              )}
            </>
          )}
          <TextInput style={[styles.input, { color: c.text, borderColor: announce ? '#f59e0b' : c.border }]} value={text} onChangeText={onChangeText}
            placeholder={editingId ? 'Bewerk je bericht…' : (announce ? 'Aankondiging…' : 'Bericht…')} placeholderTextColor={c.muted} multiline />
          <TouchableOpacity style={[styles.send, (sending || !text.trim()) && { opacity: 0.4 }]} onPress={editingId ? saveEdit : send} disabled={sending || !text.trim()}>
            <Feather name={editingId ? 'check' : 'send'} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Herinner-me-opties */}
      <Modal visible={!!remindFor} transparent animationType="fade" onRequestClose={() => setRemindFor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRemindFor(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Herinner me over…</Text>
            {remindOptions().map(([label, when]) => (
              <TouchableOpacity key={label} style={styles.modalRow} onPress={() => setReminder(when)}>
                <Feather name="clock" size={16} color="#6366f1" />
                <Text style={{ color: c.text, fontSize: 15 }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Leesbevestiging: wie heeft de aankondiging gezien */}
      <PersonCard
        userId={profielId}
        onClose={() => setProfielId(null)}
        onStartDm={async (uid) => {
          try {
            const conv = await chat.startDm([uid]);
            navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
          } catch {}
        }}
      />

      <Modal visible={!!readsModal} transparent animationType="fade" onRequestClose={() => setReadsModal(null)}>
        <Pressable style={styles.backdrop} onPress={() => setReadsModal(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Gezien door</Text>
            {readsModal?.loading ? <ActivityIndicator color="#6366f1" /> : (
              <ScrollView style={{ maxHeight: 360 }}>
                {(readsModal?.read || []).map((u) => (
                  <View key={`r${u.id}`} style={styles.readRow}><Avatar name={u.name} uri={u.avatar} size={26} /><Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{u.name}</Text><Feather name="check-circle" size={16} color="#10b981" /></View>
                ))}
                {(readsModal?.unread || []).length > 0 && <Text style={{ color: c.muted, fontSize: 12, marginTop: 10, marginBottom: 4 }}>Nog niet gezien</Text>}
                {(readsModal?.unread || []).map((u) => (
                  <View key={`u${u.id}`} style={styles.readRow}><Avatar name={u.name} uri={u.avatar} size={26} /><Text style={{ color: c.muted, fontSize: 15, flex: 1 }}>{u.name}</Text></View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  pinBar: { paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  pinChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 4 },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  // Ruimer typveld: begint op ruim twee regels en groeit verder mee. Het oude
  // veld was één regel hoog, waardoor je bij een langer bericht door een kiertje
  // zat te typen.
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, minHeight: 44, maxHeight: 180, fontSize: 16, lineHeight: 21 },
  drive: { paddingHorizontal: 4, paddingVertical: 10, justifyContent: 'center' },
  send: { backgroundColor: '#4f46e5', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
  mentionBox: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 220 },
  mentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  mentionAvatar: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center' },
  mentionAvatarText: { color: '#3730a3', fontWeight: '700', fontSize: 13 },
  mentionName: { fontSize: 15, flex: 1 },
  mentionHint: { fontSize: 12 },
  blockedBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  readRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
});
