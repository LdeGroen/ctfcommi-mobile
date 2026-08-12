import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
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

/**
 * Threads waar je aan meedoet, met het aantal antwoorden dat je nog niet zag.
 * Antwoorden tellen niet meer mee in de kanaalteller — dit is hun plek.
 */
export default function ThreadsScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const res = await chat.threads({ limit: 50 }); setItems(res.items || []); }
    catch {}
    finally { setLoading(false); }
  }, []);

  // Bij terugkeer uit een thread opnieuw laden: die is dan gelezen.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const open = (m) => {
    const conv = m.conversation || {};
    navigation.navigate('Thread', { convId: conv.id, parentId: m.id, title: 'Thread' });
  };

  const renderItem = ({ item: m }) => {
    const conv = m.conversation || {};
    const isChannel = conv.type === 'channel';
    const ongelezen = m.unread_reply_count || 0;
    return (
      <TouchableOpacity onPress={() => open(m)}
        style={[styles.card, { borderColor: ongelezen ? '#6366f1' : c.border, backgroundColor: c.card }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6366f1', flex: 1 }} numberOfLines={1}>
            {isChannel && <><Feather name={conv.is_private ? 'lock' : 'hash'} size={12} color="#6366f1" /> </>}
            {conv.display_name || 'Gesprek'}
          </Text>
          {ongelezen > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{ongelezen > 99 ? '99+' : ongelezen}</Text></View>
          )}
        </View>
        <Text style={{ marginTop: 3, color: c.text }} numberOfLines={1}>
          <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>  {fmt(m.created_at)}</Text>
        </Text>
        <Text style={{ marginTop: 2, color: c.text }} numberOfLines={2}>{preview(m)}</Text>
        <Text style={{ marginTop: 5, color: c.muted, fontSize: 12 }}>
          {m.reply_count} {m.reply_count === 1 ? 'antwoord' : 'antwoorden'}
          {m.last_reply_at ? ` · laatste ${fmt(m.last_reply_at)}` : ''}
        </Text>
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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={!loading && (
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Je doet nog aan geen enkele thread mee.</Text>
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
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
