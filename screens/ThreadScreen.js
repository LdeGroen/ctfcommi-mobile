import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { getEcho } from '../src/echo';
import { shareFromDrive } from '../src/drive';
import { convertEmoticons } from '../src/emoticons';
import MessageView, { theme } from '../src/MessageView';
import { useBottomBarInset } from '../src/useBottomBarInset';
import { useKeyboardOverlap } from '../src/useKeyboardOverlap';

export default function ThreadScreen({ route }) {
  const { convId, parentId } = route.params;
  const bottomInset = useBottomBarInset();
  const { ref: kbRef, overlap: kbOverlap } = useKeyboardOverlap();
  const dark = useColorScheme() === 'dark';
  const c = useMemo(() => theme(dark), [dark]);
  const headerHeight = useHeaderHeight();
  const [parent, setParent] = useState(null);
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const subRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await chat.listReplies(parentId);
        if (cancelled) return;
        setParent(res.parent);
        setReplies(res.replies || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [parentId]);

  useEffect(() => {
    let active = true;
    (async () => {
      const echo = await getEcho();
      if (!echo || !active) return;
      const channel = echo.private(`conversation.${convId}`);
      const onCreated = (p) => { const m = p.message; if (m.parent_id !== parentId) return; setReplies((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])); };
      const onUpdated = (p) => { const m = p.message; if (m.id === parentId) { setParent(m); return; } if (m.parent_id !== parentId) return; setReplies((prev) => prev.map((x) => (x.id === m.id ? m : x))); };
      const onDeleted = (p) => setReplies((prev) => prev.map((x) => (x.id === p.message.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
      channel.listen('.chat.message.created', onCreated);
      channel.listen('.chat.message.updated', onUpdated);
      channel.listen('.chat.message.deleted', onDeleted);
      subRef.current = { channel, onCreated, onUpdated, onDeleted };
    })();
    // Let op: GEEN echo.leave hier — dat zou de luisteraar van het chatscherm slopen.
    return () => {
      active = false;
      const r = subRef.current;
      if (r) {
        try {
          r.channel.stopListening('.chat.message.created', r.onCreated);
          r.channel.stopListening('.chat.message.updated', r.onUpdated);
          r.channel.stopListening('.chat.message.deleted', r.onDeleted);
        } catch {}
      }
    };
  }, [convId, parentId]);

  const handleReact = useCallback(async (msg, emoji) => {
    try {
      const updated = await chat.toggleReaction(msg.id, emoji);
      if (msg.id === parentId) setParent(updated);
      else setReplies((prev) => prev.map((x) => (x.id === msg.id ? updated : x)));
    } catch {}
  }, [parentId]);

  const renderReply = useCallback(({ item }) => (
    <MessageView item={item} c={c} onReact={handleReact} />
  ), [c, handleReact]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const sent = await chat.sendMessage(convId, { body, parentId });
      setReplies((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      setText('');
    } catch {} finally { setSending(false); }
  };

  const [driveBusy, setDriveBusy] = useState(false);
  const shareDrive = async () => {
    if (driveBusy) return;
    setDriveBusy(true);
    try {
      const result = await shareFromDrive({ conversationId: convId, parentId });
      if (result === 'shared') {
        try { const res = await chat.listReplies(parentId); setParent(res.parent); setReplies(res.replies || []); } catch {}
      }
    } catch {} finally { setDriveBusy(false); }
  };

  const Header = () => (
    <View>
      {parent && <MessageView item={parent} c={c} onReact={handleReact} />}
      <Text style={[styles.divider, { color: c.muted, borderColor: c.border }]}>
        {replies.length} {replies.length === 1 ? 'antwoord' : 'antwoorden'}
      </Text>
    </View>
  );

  // Zie ChatScreen: edge-to-edge (targetSdk 36) → zelf omhoog schuiven.
  return (
    <View ref={kbRef} collapsable={false} style={{ flex: 1, backgroundColor: c.bg, paddingBottom: kbOverlap }}>
      <FlatList
        data={replies}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderReply}
        ListHeaderComponent={Header}
        contentContainerStyle={{ padding: 12 }}
        initialNumToRender={15}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
      />
      <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg, paddingBottom: 8 + bottomInset }]}>
        <TouchableOpacity style={[styles.drive, driveBusy && { opacity: 0.4 }]} onPress={shareDrive} disabled={driveBusy}>
          <Feather name="hard-drive" size={20} color={c.muted} />
        </TouchableOpacity>
        <TextInput style={[styles.input, { color: c.text, borderColor: c.border }]} value={text} onChangeText={(t) => setText(convertEmoticons(t))}
          placeholder="Antwoord in thread…" placeholderTextColor={c.muted} multiline />
        <TouchableOpacity style={[styles.send, (sending || !text.trim()) && { opacity: 0.4 }]} onPress={send} disabled={sending || !text.trim()}>
          <Feather name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { fontSize: 12, paddingBottom: 6, marginBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120, fontSize: 15 },
  drive: { paddingHorizontal: 4, paddingVertical: 10, justifyContent: 'center' },
  send: { backgroundColor: '#4f46e5', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
});
