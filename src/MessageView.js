import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Eén bericht. Geef onOpenThread mee om de thread-knop te tonen.
export default function MessageView({ item, c, onOpenThread }) {
  if (item.deleted_at) {
    return <Text style={[s.deleted, { color: c.muted }]}>bericht verwijderd</Text>;
  }
  return (
    <View style={s.msg}>
      <Text style={[s.author, { color: c.text }]}>
        {item.user?.name || 'Onbekend'} <Text style={[s.time, { color: c.muted }]}>{fmt(item.created_at)}</Text>
      </Text>
      {!!item.body && <Markdown style={{ body: { color: c.text, fontSize: 15 }, link: { color: '#6366f1' } }}>{item.body}</Markdown>}
      {item.attachments?.map((a) => (
        <Text key={a.id} style={{ color: '#6366f1', marginTop: 2 }} onPress={() => Linking.openURL(a.url)}>📎 {a.filename}</Text>
      ))}
      {item.reactions?.length > 0 && (
        <Text style={{ marginTop: 2, color: c.text }}>{item.reactions.map((r) => `${r.emoji} ${r.count}`).join('  ')}</Text>
      )}
      {onOpenThread && (
        <TouchableOpacity onPress={() => onOpenThread(item)}>
          <Text style={{ color: '#6366f1', marginTop: 4, fontSize: 13 }}>
            {item.reply_count > 0 ? `💬 ${item.reply_count} ${item.reply_count === 1 ? 'antwoord' : 'antwoorden'}` : '💬 Reageren in thread'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  msg: { marginBottom: 12 },
  author: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 11, fontWeight: '400' },
  deleted: { fontStyle: 'italic', marginBottom: 12, fontSize: 13 },
});

export const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});
