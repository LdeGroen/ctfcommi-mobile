import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { theme } from '../src/MessageView';

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Toont de tekst met de zoekterm vetgedrukt/gemarkeerd.
function Highlighted({ text, query, c }) {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  if (!query) return <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={3}>{clean}</Text>;
  const parts = clean.split(new RegExp(`(${escapeRegExp(query)})`, 'ig'));
  return (
    <Text style={{ color: c.text, fontSize: 14 }} numberOfLines={3}>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase()
          ? <Text key={i} style={{ color: '#6366f1', fontWeight: '700' }}>{p}</Text>
          : <Text key={i}>{p}</Text>
      )}
    </Text>
  );
}

export default function SearchScreen({ route, navigation }) {
  const { conversationId = null, conversationName = null } = route.params || {};
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: conversationName ? `Zoeken in ${conversationName}` : 'Zoeken' });
  }, [navigation, conversationName]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setItems([]); setSearched(false); setLoading(false); return; }
    let active = true;
    setLoading(true); setSearched(true);
    const t = setTimeout(async () => {
      try {
        const res = await chat.search({ q: query, conversationId, limit: 30 });
        if (active) setItems(res.items || []);
      } catch { if (active) setItems([]); }
      finally { if (active) setLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(t); };
  }, [q, conversationId]);

  const openResult = (m) => {
    const conv = m.conversation || {};
    if (m.parent_id) {
      navigation.navigate('Thread', { convId: conv.id, parentId: m.parent_id, title: 'Thread' });
    } else {
      navigation.navigate('Chat', { id: conv.id, title: conv.display_name || 'Gesprek' });
    }
  };

  const renderItem = ({ item }) => {
    const conv = item.conversation || {};
    const isReply = !!item.parent_id;
    const body = (item.body || '').trim() || (item.attachments?.length ? '📎 Bijlage' : '');
    return (
      <TouchableOpacity style={[styles.row, { borderColor: c.border }]} onPress={() => openResult(item)}>
        <Text style={[styles.conv, { color: '#6366f1' }]} numberOfLines={1}>
          {conv.type === 'channel' && <Feather name={conv.is_private ? 'lock' : 'hash'} size={11} color="#6366f1" />}
          {' '}{conv.display_name || 'Gesprek'}{isReply ? '  · thread' : ''}
        </Text>
        <Text style={[styles.author, { color: c.text }]} numberOfLines={1}>
          {item.user?.name || 'Onbekend'} <Text style={{ color: c.muted, fontWeight: '400', fontSize: 12 }}>{fmt(item.created_at)}</Text>
        </Text>
        <Highlighted text={body} query={q.trim()} c={c} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* Naast het veld staat altijd een uitweg. Met het toetsenbord omhoog is
          de terugpijl in de header makkelijk over het hoofd te zien, en wie
          niets invulde bleef daardoor in het zoekscherm hangen. */}
      <View style={styles.searchBar}>
        <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: dark ? '#111827' : '#f3f4f6' }]}>
          <Feather name="search" size={16} color={c.muted} />
          <TextInput
            autoFocus value={q} onChangeText={setQ}
            placeholder="Typ een woord of zin…" placeholderTextColor={c.muted}
            returnKeyType="search"
            style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 6 }}
          />
          {q.length > 0 && (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Zoekterm wissen">
              <Feather name="x-circle" size={16} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.cancel}>
          <Text style={{ color: '#6366f1', fontSize: 15 }}>Annuleren</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>
            {q.trim().length < 2 ? 'Typ minstens 2 tekens om te zoeken.' : loading ? 'Zoeken…' : searched ? `Niets gevonden voor "${q.trim()}".` : ''}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  cancel: { paddingVertical: 6 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  conv: { fontSize: 12, fontWeight: '600' },
  author: { fontSize: 14, fontWeight: '600', marginTop: 2 },
});
