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

export default function SavedScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chat.saved().then((res) => setItems(res.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const open = (m) => {
    const conv = m.conversation || {};
    if (m.parent_id) navigation.navigate('Thread', { convId: conv.id, parentId: m.parent_id, title: 'Thread' });
    else navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
  };

  const unsave = async (messageId) => {
    setItems((prev) => prev.filter((m) => m.id !== messageId));
    try { await chat.toggleSave(messageId); } catch {}
  };

  const renderItem = ({ item: m }) => {
    const conv = m.conversation || {};
    const isChannel = conv.type === 'channel';
    return (
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <TouchableOpacity onPress={() => open(m)} style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366f1' }} numberOfLines={1}>
            {isChannel && <><Feather name={conv.is_private ? 'lock' : 'hash'} size={12} color="#6366f1" /> </>}
            {conv.display_name || 'Gesprek'}{m.parent_id ? ' · in thread' : ''}
          </Text>
          <Text style={{ marginTop: 3, color: c.text }} numberOfLines={1}>
            <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>  {fmt(m.created_at)}</Text>
          </Text>
          <Text style={{ marginTop: 2, color: c.text }} numberOfLines={2}>{preview(m)}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => unsave(m.id)} style={{ padding: 4 }}>
          <Feather name="bookmark" size={18} color="#f59e0b" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 12 }}
      data={items}
      keyExtractor={(x) => String(x.id)}
      renderItem={renderItem}
      ListEmptyComponent={!loading && (
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Nog niets bewaard. Houd een bericht ingedrukt en kies "Bewaren voor later".</Text>
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
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
