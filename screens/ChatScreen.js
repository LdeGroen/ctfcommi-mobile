import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform, StyleSheet, useColorScheme } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';
import { shareFromDrive } from '../src/drive';
import { convertEmoticons } from '../src/emoticons';
import MessageView, { theme } from '../src/MessageView';

export default function ChatScreen({ route, navigation }) {
  const { id } = route.params;
  const dark = useColorScheme() === 'dark';
  const c = useMemo(() => theme(dark), [dark]);
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [mentionItems, setMentionItems] = useState([]);
  const subRef = useRef(null);
  const draftTimer = useRef(null);

  const markRead = (lastId) => chat.markRead(id, lastId).catch(() => {});

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
        const [res, det] = await Promise.all([chat.listMessages(id, { limit: 40 }), chat.getConversation(id)]);
        if (cancelled) return;
        const msgs = res.messages || [];
        setMessages(msgs);
        setMembers(det?.members || []);
        if (det?.draft) setText(det.draft); // concept van een ander apparaat
        if (msgs.length) markRead(msgs[msgs.length - 1].id);
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
      const onUpdated = (p) => setMessages((prev) => prev.map((x) => (x.id === p.message.id ? p.message : x)));
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
    // Concept gedebounced naar de server (synct over apparaten).
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => { chat.saveDraft(id, t).catch(() => {}); }, 800);
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
      const sent = await chat.sendMessage(id, { body, mentionUserIds: resolveMentionIds(body) });
      setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      setText('');
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

  const openThread = useCallback((item) => navigation.navigate('Thread', { convId: id, parentId: item.id, title: 'Thread' }), [id, navigation]);

  const renderItem = useCallback(({ item }) => (
    <MessageView item={item} c={c} onOpenThread={openThread} onReact={handleReact} />
  ), [c, openThread, handleReact]);

  const data = [...messages].reverse(); // inverted: nieuwste onderaan

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}>
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
      <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg }]}>
        <TouchableOpacity style={[styles.drive, driveBusy && { opacity: 0.4 }]} onPress={shareDrive} disabled={driveBusy}>
          <Feather name="hard-drive" size={20} color={c.muted} />
        </TouchableOpacity>
        <TextInput style={[styles.input, { color: c.text, borderColor: c.border }]} value={text} onChangeText={onChangeText}
          placeholder="Bericht…" placeholderTextColor={c.muted} multiline />
        <TouchableOpacity style={[styles.send, (sending || !text.trim()) && { opacity: 0.4 }]} onPress={send} disabled={sending || !text.trim()}>
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120, fontSize: 15 },
  drive: { paddingHorizontal: 4, paddingVertical: 10, justifyContent: 'center' },
  send: { backgroundColor: '#4f46e5', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
  mentionBox: { borderTopWidth: StyleSheet.hairlineWidth, maxHeight: 220 },
  mentionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  mentionAvatar: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#c7d2fe', alignItems: 'center', justifyContent: 'center' },
  mentionAvatarText: { color: '#3730a3', fontWeight: '700', fontSize: 13 },
  mentionName: { fontSize: 15, flex: 1 },
  mentionHint: { fontSize: 12 },
});
