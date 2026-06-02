import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, useColorScheme, Linking } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen({ route }) {
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

  const data = [...messages].reverse(); // inverted lijst: nieuwste onderaan

  const renderItem = ({ item }) => item.deleted_at ? (
    <Text style={[styles.deleted, { color: c.muted }]}>bericht verwijderd</Text>
  ) : (
    <View style={styles.msg}>
      <Text style={[styles.author, { color: c.text }]}>
        {item.user?.name || 'Onbekend'} <Text style={[styles.time, { color: c.muted }]}>{fmt(item.created_at)}</Text>
      </Text>
      {!!item.body && <Markdown style={{ body: { color: c.text, fontSize: 15 }, link: { color: '#6366f1' } }}>{item.body}</Markdown>}
      {item.attachments?.map((a) => (
        <Text key={a.id} style={{ color: '#6366f1', marginTop: 2 }} onPress={() => Linking.openURL(a.url)}>📎 {a.filename}</Text>
      ))}
      {item.reactions?.length > 0 && (
        <Text style={{ marginTop: 2 }}>{item.reactions.map((r) => `${r.emoji} ${r.count}`).join('  ')}</Text>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList inverted data={data} keyExtractor={(x) => String(x.id)} renderItem={renderItem} contentContainerStyle={{ padding: 12 }} />
      <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg }]}>
        <TextInput style={[styles.input, { color: c.text, borderColor: c.border }]} value={text} onChangeText={setText}
          placeholder="Bericht…" placeholderTextColor={c.muted} multiline />
        <TouchableOpacity style={[styles.send, (sending || !text.trim()) && { opacity: 0.4 }]} onPress={send} disabled={sending || !text.trim()}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>Stuur</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

const styles = StyleSheet.create({
  msg: { marginBottom: 12 },
  author: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 11, fontWeight: '400' },
  deleted: { fontStyle: 'italic', marginBottom: 12, fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120, fontSize: 15 },
  send: { backgroundColor: '#4f46e5', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
});
