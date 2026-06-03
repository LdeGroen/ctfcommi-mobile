import React, { useEffect, useRef, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, KeyboardAvoidingView, Platform, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';
import { shareFromDrive } from '../src/drive';
import MessageView, { theme } from '../src/MessageView';

export default function ChatScreen({ route, navigation }) {
  const { id } = route.params;
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const subRef = useRef(null);

  const markRead = (lastId) => chat.markRead(id, lastId).catch(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await chat.listMessages(id, { limit: 40 });
        if (cancelled) return;
        const msgs = res.messages || [];
        setMessages(msgs);
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

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const sent = await chat.sendMessage(id, { body });
      setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      setText('');
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

  const handleReact = async (msg, emoji) => {
    try {
      const updated = await chat.toggleReaction(msg.id, emoji);
      setMessages((prev) => prev.map((x) => (x.id === msg.id ? updated : x)));
    } catch {}
  };

  const openThread = (item) => navigation.navigate('Thread', { convId: id, parentId: item.id, title: 'Thread' });

  const data = [...messages].reverse(); // inverted: nieuwste onderaan

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        inverted
        data={data}
        keyExtractor={(x) => String(x.id)}
        renderItem={({ item }) => <MessageView item={item} c={c} onOpenThread={openThread} onReact={handleReact} />}
        contentContainerStyle={{ padding: 12 }}
      />
      <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg }]}>
        <TouchableOpacity style={[styles.drive, driveBusy && { opacity: 0.4 }]} onPress={shareDrive} disabled={driveBusy}>
          <Feather name="hard-drive" size={20} color={c.muted} />
        </TouchableOpacity>
        <TextInput style={[styles.input, { color: c.text, borderColor: c.border }]} value={text} onChangeText={setText}
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
});
