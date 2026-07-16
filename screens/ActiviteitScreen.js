import React, { useEffect, useState } from 'react';
import { Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function preview(m) {
  const txt = (m.body || '').replace(/[*_`~#>[\]()]/g, '').replace(/\s+/g, ' ').trim();
  if (txt) return txt.length > 180 ? txt.slice(0, 180) + '…' : txt;
  if (m.title) return m.title;
  if (m.attachments?.length) return '📎 Bijlage';
  return '';
}
function reason(item) {
  const who = item.actor || 'Iemand';
  if (item.type === 'reaction') return { icon: 'smile', color: '#f59e0b', text: `${who} reageerde met ${item.emoji} op je bericht` };
  if (item.type === 'mention') return { icon: 'at-sign', color: '#6366f1', text: `${who} noemde je` };
  return { icon: 'message-square', color: '#6366f1', text: `${who} reageerde in een thread` };
}

export default function ActiviteitScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chat.activityFeed({ limit: 50 }).then((res) => setItems(res.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const open = (item) => {
    const conv = item.conversation || {};
    const m = item.message || {};
    if (m.parent_id) navigation.navigate('Thread', { convId: conv.id, parentId: m.parent_id, title: 'Thread' });
    else navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
  };

  const renderItem = ({ item }) => {
    const m = item.message || {};
    const conv = item.conversation || {};
    const isChannel = conv.type === 'channel';
    const r = reason(item);
    return (
      <TouchableOpacity onPress={() => open(item)} style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Feather name={r.icon} size={13} color={r.color} />
          <Text style={{ color: c.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{r.text}</Text>
          <Text style={{ color: c.muted, fontSize: 11 }}>{fmt(item.at)}</Text>
        </View>
        <Text style={{ marginTop: 4, fontSize: 12, fontWeight: '600', color: '#6366f1' }} numberOfLines={1}>
          {isChannel && <><Feather name={conv.is_private ? 'lock' : 'hash'} size={11} color="#6366f1" /> </>}
          {conv.display_name || 'Gesprek'}
        </Text>
        <Text style={{ marginTop: 2, color: c.text }} numberOfLines={2}>
          <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>{'  '}{preview(m)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 12 }}
      data={items}
      keyExtractor={(item, i) => `${item.type}-${item.message?.id}-${i}`}
      renderItem={renderItem}
      ListEmptyComponent={!loading && (
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Nog geen activiteit. Reacties, thread-antwoorden en vermeldingen verschijnen hier.</Text>
      )}
    />
  );
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#f3f4f6',
  card: dark ? '#111827' : '#ffffff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
});
