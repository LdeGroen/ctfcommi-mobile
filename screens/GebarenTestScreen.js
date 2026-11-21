import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Row } from './ConversationsScreen';
import MessageView, { theme as berichtThema } from '../src/MessageView';

/**
 * Gebaren-test (alleen in een test-APK, zie src/testschermen.js).
 *
 * Toont de ECHTE onderdelen van de ingelogde schermen met verzonnen gegevens:
 * de gespreksrijen met hun veegacties (Row uit ConversationsScreen) en de
 * berichten in een omgekeerde lijst (MessageView, zoals in ChatScreen). Zo is
 * op de emulator na te lopen of scrollen, tikken, lang drukken en vegen werken,
 * zonder in te loggen. Bovenin staat wat er als laatste is herkend, zodat een
 * screenshot laat zien of een tik aankwam.
 */

const NAMEN = ['Anna', 'Bram', 'Christiaan', 'Daan', 'Eva', 'Fleur', 'Gijs', 'Hanna', 'Ilse', 'Joris'];

function nepGesprekken() {
  const lijst = [];
  for (let i = 1; i <= 40; i += 1) {
    const kanaal = i % 3 === 0;
    lijst.push({
      id: i,
      type: kanaal ? 'channel' : 'dm',
      name: kanaal ? `kanaal-${i}` : null,
      display_name: kanaal ? `kanaal-${i}` : `${NAMEN[i % NAMEN.length]} ${i}`,
      unread_count: i % 4 === 0 ? i : 0,
      last_message: { body: `Laatste bericht in gesprek ${i}`, user_name: NAMEN[(i + 3) % NAMEN.length] },
    });
  }
  return lijst;
}

function nepBerichten() {
  const nu = Date.now();
  const lijst = [];
  for (let i = 1; i <= 60; i += 1) {
    lijst.push({
      id: i,
      kind: 'message',
      user_id: i % 5,
      user: { id: i % 5, name: NAMEN[i % NAMEN.length] },
      body: i % 7 === 0
        ? `Bericht ${i} met een link: https://cafetheaterfestival.nl en wat **vet** erbij, zodat het langer wordt dan één regel.`
        : `Bericht ${i}`,
      created_at: new Date(nu - (60 - i) * 60000).toISOString(),
      reactions: [],
    });
  }
  return lijst.reverse(); // omgekeerde lijst: nieuwste eerst
}

export default function GebarenTestScreen() {
  const dark = useColorScheme() === 'dark';
  const c = berichtThema(dark);
  const [stand, setStand] = useState('gesprekken');
  const [log, setLog] = useState('nog niets');
  const teller = useRef(0);
  const meld = useCallback((tekst) => { teller.current += 1; setLog(`#${teller.current} ${tekst}`); }, []);

  const gesprekken = useMemo(nepGesprekken, []);
  const berichten = useMemo(nepBerichten, []);
  const nepNavigatie = useMemo(() => ({ navigate: (naam, p) => meld(`tik op rij ${p?.id} (${naam})`) }), [meld]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[st.balk, { borderColor: c.border }]}>
        {['gesprekken', 'chat'].map((s) => (
          <TouchableOpacity key={s} onPress={() => { setStand(s); meld(`stand ${s}`); }}
            style={[st.knop, stand === s && st.knopAan]}>
            <Text style={[st.knopTekst, stand === s && { color: '#fff' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
        <Text testID="log" style={[st.log, { color: c.text }]} numberOfLines={1}>{log}</Text>
      </View>

      {stand === 'gesprekken' ? (
        <FlatList
          data={gesprekken}
          keyExtractor={(x) => String(x.id)}
          onScroll={(e) => setLog((l) => (l.startsWith('scroll') ? `scroll y=${Math.round(e.nativeEvent.contentOffset.y)}` : l))}
          onScrollBeginDrag={() => meld('scroll begint')}
          onScrollEndDrag={(e) => meld(`scroll y=${Math.round(e.nativeEvent.contentOffset.y)}`)}
          renderItem={({ item }) => (
            <Row item={item} c={c} navigation={nepNavigatie}
              onHide={(id) => meld(`verberg ${id}`)} onFav={(id) => meld(`favoriet ${id}`)} onGeopend={() => {}} />
          )}
        />
      ) : (
        <FlatList
          inverted
          data={berichten}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 12 }}
          onScrollBeginDrag={() => meld('scroll begint')}
          onScrollEndDrag={(e) => meld(`scroll y=${Math.round(e.nativeEvent.contentOffset.y)}`)}
          removeClippedSubviews
          renderItem={({ item }) => (
            <MessageView item={item} c={c} me={{ id: 0 }}
              onReact={(m, e) => meld(`reactie ${e} op ${m.id}`)}
              onOpenThread={(m) => meld(`thread ${m.id}`)}
              onOpenProfile={(id) => meld(`profiel ${id}`)}
              onSave={(m) => meld(`bewaar ${m.id}`)} />
          )}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  balk: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderBottomWidth: 1 },
  knop: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#e5e7eb' },
  knopAan: { backgroundColor: '#396971' },
  knopTekst: { fontSize: 13, fontWeight: '600', color: '#111827' },
  log: { flex: 1, fontSize: 13, fontFamily: 'monospace' },
});
