import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import Avatar from '../src/Avatar';
import { groepeerThreads } from '../src/overzicht';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function preview(m) {
  const txt = (m.body || m.title || '').replace(/[*_`~#>[\]()]/g, '').replace(/\s+/g, ' ').trim();
  if (txt) return txt.length > 200 ? txt.slice(0, 200) + '…' : txt;
  if (m.attachments?.length || m.has_attachments) return '📎 Bijlage';
  return '';
}

// Per kanaal eerst zoveel threads; per thread komen de laatste twee antwoorden
// van de backend mee.
const THREADS_PER_KANAAL = 3;

function Badge({ n }) {
  if (!n) return null;
  return <View style={styles.badge}><Text style={styles.badgeText}>{n > 99 ? '99+' : n}</Text></View>;
}

function Regel({ m, c, onPress, regels = 3, rechts = null }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.regel}>
      <Avatar name={m.user?.name} uri={m.user?.avatar} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: c.text, flex: 1 }} numberOfLines={1}>
            <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>  {fmt(m.created_at)}</Text>
          </Text>
          {rechts}
        </View>
        <Text style={{ marginTop: 1, color: c.text }} numberOfLines={regels}>{preview(m)}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Threads waar je aan meedoet, per kanaal (6-11-2026): per kanaal de drie
 * nieuwste threads met "Meer threads", per thread de laatste twee antwoorden
 * getrapt onder het startbericht. Zelfde indeling als ThreadsView in ctfcommi.
 * Antwoorden tellen niet meer mee in de kanaalteller — dit is hun plek.
 */
export default function ThreadsScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState({}); // kanaal-id -> alle threads tonen

  const load = useCallback(async () => {
    try { const res = await chat.threads({ limit: 100 }); setItems(res.items || []); }
    catch {}
    finally { setLoading(false); }
  }, []);

  // Bij terugkeer uit een thread opnieuw laden: die is dan gelezen.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const groepen = useMemo(() => groepeerThreads(items), [items]);

  const openThread = (t) => navigation.navigate('Thread', { convId: t.conversation?.id, parentId: t.id, title: 'Thread' });
  const openGesprek = (conv) => navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });

  const renderThread = (t) => {
    const antwoorden = t.laatste_antwoorden || [];
    const eerder = Math.max(0, (t.reply_count || 0) - antwoorden.length);
    return (
      <View key={t.id} style={[styles.thread, t.unread_reply_count ? { backgroundColor: dark ? '#1e1b4b' : '#eef2ff' } : null]}>
        <Regel m={t} c={c} onPress={() => openThread(t)} regels={2} rechts={<Badge n={t.unread_reply_count} />} />
        {/* Getrapt: de antwoorden horen bij het bericht hierboven. */}
        <View style={[styles.trap, { borderLeftColor: dark ? '#3730a3' : '#c7d2fe' }]}>
          {eerder > 0 && (
            <TouchableOpacity onPress={() => openThread(t)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#6366f1', fontWeight: '600', fontSize: 13 }}>
                Bekijk {eerder} eerdere {eerder === 1 ? 'reactie' : 'reacties'}
              </Text>
            </TouchableOpacity>
          )}
          {antwoorden.map((a) => <Regel key={a.id} m={a} c={c} onPress={() => openThread(t)} />)}
        </View>
      </View>
    );
  };

  const renderItem = ({ item: g }) => {
    const conv = g.conversation;
    const isChannel = conv.type === 'channel';
    const alles = !!open[conv.id];
    const zichtbaar = alles ? g.threads : g.threads.slice(0, THREADS_PER_KANAAL);
    const meer = g.threads.length - zichtbaar.length;
    return (
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <TouchableOpacity onPress={() => openGesprek(conv)} style={[styles.kop, { borderBottomColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>
              {isChannel && <><Feather name={conv.is_private ? 'lock' : 'hash'} size={14} color={c.text} /> </>}
              {conv.display_name || 'Gesprek'}
            </Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>
              {g.threads.length} {g.threads.length === 1 ? 'thread' : 'threads'}
            </Text>
          </View>
          <Badge n={g.ongelezen} />
        </TouchableOpacity>
        <View style={{ padding: 4, gap: 6 }}>
          {zichtbaar.map(renderThread)}
          {g.threads.length > THREADS_PER_KANAAL && (
            <TouchableOpacity onPress={() => setOpen((o) => ({ ...o, [conv.id]: !alles }))} style={{ paddingHorizontal: 8, paddingVertical: 8 }}>
              <Text style={{ color: '#6366f1', fontWeight: '600' }}>{alles ? 'Minder threads' : `Meer threads (${meer})`}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 12 }}
      data={groepen}
      keyExtractor={(g) => String(g.conversation.id)}
      renderItem={renderItem}
      extraData={open}
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
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  kop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  thread: { borderRadius: 8, paddingBottom: 4 },
  regel: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  trap: { marginLeft: 22, paddingLeft: 8, borderLeftWidth: 2 },
  badge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
