import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { chat } from '../src/api';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function preview(m) {
  const txt = (m.body || '').replace(/[*_`~#>[\]()]/g, '').replace(/\s+/g, ' ').trim();
  if (txt) return txt.length > 200 ? txt.slice(0, 200) + '…' : txt;
  if (m.attachments?.length) return '📎 Bijlage';
  return '';
}

export default function ActivityScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (before) => {
    const res = await chat.activity({ before, limit: 30 });
    setItems((prev) => (before ? [...prev, ...(res.items || [])] : (res.items || [])));
    setHasMore(!!res.has_more);
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const loadOlder = async () => {
    if (!items.length) return;
    setLoadingMore(true);
    try { await load(items[items.length - 1].id); } finally { setLoadingMore(false); }
  };

  const open = (m) => {
    const conv = m.conversation || {};
    if (m.parent_id) navigation.navigate('Thread', { convId: conv.id, parentId: m.parent_id, title: 'Thread' });
    else navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
  };

  const renderItem = ({ item: m }) => {
    const conv = m.conversation || {};
    const prefix = conv.type === 'channel' ? (conv.is_private ? '🔒 ' : '# ') : '';
    return (
      <TouchableOpacity onPress={() => open(m)} style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366f1' }} numberOfLines={1}>
          {prefix}{conv.display_name || 'Gesprek'}{m.parent_id ? ' · in thread' : ''}
        </Text>
        <Text style={{ marginTop: 3, color: c.text }} numberOfLines={1}>
          <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>  {fmt(m.created_at)}</Text>
        </Text>
        <Text style={{ marginTop: 2, color: c.text }} numberOfLines={2}>{preview(m)}</Text>
      </TouchableOpacity>
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
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Geen activiteit in de afgelopen 30 dagen.</Text>
      )}
      ListFooterComponent={hasMore ? (
        <TouchableOpacity onPress={loadOlder} disabled={loadingMore} style={{ paddingVertical: 14, alignItems: 'center' }}>
          <Text style={{ color: '#6366f1', fontWeight: '600' }}>{loadingMore ? 'Laden…' : 'Ouder laden'}</Text>
        </TouchableOpacity>
      ) : null}
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
