import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, useColorScheme } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import Avatar from '../src/Avatar';
import GroepAvatar from '../src/GroepAvatar';

/**
 * Delen in een ander kanaal of gesprek (17-11-2026). Een gewoon bericht gaat
 * als citaat, met je eigen tekst erbij; een notitie of to-dolijst als losse
 * kopie. Na het delen vervangt het doelgesprek dit scherm, zodat Terug je
 * weer bij het origineel brengt.
 * Zelfde scherm staat in ctfcommi (src/components/DeelDialoog.jsx).
 */
export default function DeelScherm({ route, navigation }) {
  const { bericht } = route.params;
  const dark = useColorScheme() === 'dark';
  const c = {
    bg: dark ? '#0b1220' : '#ffffff', text: dark ? '#f3f4f6' : '#111827', muted: dark ? '#9ca3af' : '#6b7280',
    border: dark ? '#1f2937' : '#e5e7eb', kies: dark ? '#312e81' : '#e0e7ff',
  };
  const isNotitie = bericht.kind === 'note';
  const [gesprekken, setGesprekken] = useState(null);
  const [zoek, setZoek] = useState('');
  const [doel, setDoel] = useState(null);
  const [tekst, setTekst] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isNotitie ? (bericht.note_type === 'todo' ? 'To-dolijst delen' : 'Notitie delen') : 'Bericht delen' });
    chat.listConversations()
      .then((r) => setGesprekken((r.conversations || []).filter((g) => !g.is_archived && g.can_post !== false)))
      .catch(() => setGesprekken([]));
  }, [navigation, isNotitie, bericht.note_type]);

  const lijst = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    return (gesprekken || []).filter((g) => !z || (g.display_name || g.name || '').toLowerCase().includes(z));
  }, [gesprekken, zoek]);

  const delen = async () => {
    if (!doel) return;
    setBezig(true);
    try {
      await chat.shareMessage(bericht.id, doel.id, isNotitie ? '' : tekst);
      navigation.dispatch(StackActions.replace('Chat', { id: doel.id, title: doel.display_name || doel.name || 'Gesprek' }));
    } catch (e) {
      setBezig(false);
      Alert.alert('Delen mislukt', e.message || '');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <TextInput value={zoek} onChangeText={setZoek} placeholder="Zoek een kanaal of gesprek" placeholderTextColor={c.muted}
                 style={[st.zoek, { color: c.text, borderColor: c.border }]} />
      {gesprekken === null ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
        <FlatList
          style={{ flex: 1 }}
          data={lijst}
          keyExtractor={(g) => String(g.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: g }) => (
            <TouchableOpacity onPress={() => setDoel(g)} style={[st.rij, doel?.id === g.id && { backgroundColor: c.kies }]}>
              <View style={{ width: 30, alignItems: 'center' }}>
                {g.type === 'channel'
                  ? <Feather name={g.is_private ? 'lock' : 'hash'} size={16} color={c.muted} />
                  : g.peer_avatars?.length > 1
                    ? <GroepAvatar leden={g.peer_avatars} anderen={(g.member_count || 1) - 1} size={28} />
                    : <Avatar name={g.display_name} uri={g.peer_avatar} size={28} />}
              </View>
              <Text style={{ color: c.text, fontSize: 15, flex: 1, fontWeight: doel?.id === g.id ? '700' : '400' }} numberOfLines={1}>
                {g.display_name || g.name}
              </Text>
              {doel?.id === g.id && <Feather name="check" size={18} color="#6366f1" />}
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ color: c.muted, padding: 16 }}>Niets gevonden.</Text>}
        />
      )}
      <View style={[st.voet, { borderColor: c.border }]}>
        {isNotitie ? (
          <Text style={{ color: c.muted, fontSize: 13, marginBottom: 8 }}>
            Er komt een kopie in het gekozen gesprek. Wat je daarna aanpast of afvinkt, geldt alleen op die plek.
          </Text>
        ) : (
          <TextInput value={tekst} onChangeText={setTekst} placeholder="Zet er iets bij (mag leeg)" placeholderTextColor={c.muted}
                     multiline style={[st.tekst, { color: c.text, borderColor: c.border }]} />
        )}
        <TouchableOpacity onPress={delen} disabled={!doel || bezig} style={[st.knop, (!doel || bezig) && { opacity: 0.4 }]}>
          {bezig ? <ActivityIndicator color="#fff" /> : <Text style={st.knopTekst}>{doel ? `Delen in ${doel.display_name || doel.name}` : 'Kies waar het heen moet'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  zoek: { margin: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  rij: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  voet: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, paddingBottom: 28 },
  tekst: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, minHeight: 44, marginBottom: 10 },
  knop: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  knopTekst: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
