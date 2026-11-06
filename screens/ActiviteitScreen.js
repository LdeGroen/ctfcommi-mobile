import React, { useEffect, useMemo, useState } from 'react';
import { Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import Avatar from '../src/Avatar';
import { groepeerOverzicht, activiteitNaarBerichten, opGebeurtenis } from '../src/overzicht';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function preview(m) {
  if (m.deleted_at) return 'Dit bericht is verwijderd';
  const txt = (m.body || '').replace(/[*_`~#>[\]()]/g, '').replace(/\s+/g, ' ').trim();
  if (txt) return txt.length > 180 ? txt.slice(0, 180) + '…' : txt;
  if (m.title) return m.title;
  if (m.attachments?.length) return '📎 Bijlage';
  return '';
}
// Waarom staat dit bericht hier ("wie deed wat").
function reden(r) {
  const who = r.actor || 'Iemand';
  if (r.type === 'reaction') return { icon: 'smile', color: '#f59e0b', text: `${who} reageerde met ${r.emoji}` };
  if (r.type === 'mention') return { icon: 'at-sign', color: '#6366f1', text: `${who} noemde je` };
  return { icon: 'message-square', color: '#6366f1', text: `${who} antwoordde` };
}

function Regel({ m, c, onPress, regels = 3 }) {
  const redenen = m.redenen || [];
  return (
    <TouchableOpacity onPress={onPress} style={styles.regel}>
      <Avatar name={m.user?.name} uri={m.user?.avatar} size={28} />
      <View style={{ flex: 1, minWidth: 0 }}>
        {redenen.map((r, i) => {
          const x = reden(r);
          return (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Feather name={x.icon} size={12} color={x.color} />
              <Text style={{ color: c.muted, fontSize: 12, flex: 1 }} numberOfLines={1}>{x.text}</Text>
              {i === 0 && <Text style={{ color: c.muted, fontSize: 11 }}>{fmt(m.at)}</Text>}
            </View>
          );
        })}
        <Text style={{ color: c.text }} numberOfLines={1}>
          <Text style={{ fontWeight: '600' }}>{m.user?.name || 'Onbekend'}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>  {fmt(m.created_at)}</Text>
        </Text>
        <Text style={{ marginTop: 1, color: m.deleted_at ? c.muted : c.text, fontStyle: m.deleted_at ? 'italic' : 'normal' }}
              numberOfLines={regels}>{preview(m)}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Persoonlijke activiteit: reacties op jouw berichten, antwoorden in je
 * threads en vermeldingen. Sinds 6-11-2026 per kanaal en per thread, net als
 * het Overzicht, met bij elk bericht waarom het er staat.
 */
export default function ActiviteitScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chat.activityFeed({ limit: 60 }).then((res) => setItems(res.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const groepen = useMemo(
    () => groepeerOverzicht(activiteitNaarBerichten(items), { sleutel: opGebeurtenis }),
    [items],
  );

  const openGesprek = (conv) => navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
  const openThread = (conv, threadId) => navigation.navigate('Thread', { convId: conv.id, parentId: threadId, title: 'Thread' });

  const renderBlok = (conv, blok) => {
    if (!blok.threadId) {
      const m = blok.berichten[0];
      return <Regel key={blok.sleutel} m={m} c={c} onPress={() => (m.reply_count ? openThread(conv, m.id) : openGesprek(conv))} />;
    }
    const open = () => openThread(conv, blok.threadId);
    const eerder = blok.eerdereAntwoorden;
    return (
      <View key={blok.sleutel}>
        {blok.start
          ? <Regel m={blok.start} c={c} onPress={open} regels={2} />
          : (
            <TouchableOpacity onPress={open} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: c.muted, fontSize: 12 }}>Antwoorden in een thread</Text>
            </TouchableOpacity>
          )}
        {/* Getrapt: alles hieronder hoort bij dezelfde thread. */}
        <View style={[styles.trap, { borderLeftColor: dark ? '#3730a3' : '#c7d2fe' }]}>
          {eerder > 0 && (
            <TouchableOpacity onPress={open} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#6366f1', fontWeight: '600', fontSize: 13 }}>
                Bekijk {eerder} eerdere {eerder === 1 ? 'reactie' : 'reacties'}
              </Text>
            </TouchableOpacity>
          )}
          {blok.berichten.map((m) => <Regel key={m.id} m={m} c={c} onPress={open} />)}
        </View>
      </View>
    );
  };

  const renderItem = ({ item: g }) => {
    const conv = g.conversation;
    const isChannel = conv.type === 'channel';
    return (
      <View style={[styles.card, { borderColor: c.border, backgroundColor: c.card }]}>
        <TouchableOpacity onPress={() => openGesprek(conv)} style={[styles.kop, { borderBottomColor: c.border }]}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: c.text }} numberOfLines={1}>
            {isChannel && <><Feather name={conv.is_private ? 'lock' : 'hash'} size={14} color={c.text} /> </>}
            {conv.display_name || 'Gesprek'}
          </Text>
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 1 }}>laatste {fmt(g.laatste)}</Text>
        </TouchableOpacity>
        <View style={{ padding: 4 }}>
          {g.blokken.map((b) => renderBlok(conv, b))}
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
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  kop: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  regel: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  trap: { marginLeft: 22, paddingLeft: 8, borderLeftWidth: 2 },
});
