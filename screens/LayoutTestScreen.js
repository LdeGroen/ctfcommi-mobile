import React, { useState } from 'react';
import { View, FlatList, TextInput, TouchableOpacity, Text, StyleSheet, useColorScheme } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Feather } from '@expo/vector-icons';
import { theme } from '../src/MessageView';
import { useBottomBarInset } from '../src/useBottomBarInset';
import { useKeyboardOverlap } from '../src/useKeyboardOverlap';

/**
 * Verborgen layout-testscherm (lang drukken op het logo in het inlogscherm).
 *
 * Waarom dit bestaat: het toetsenbord-/navigatiebalk-gedrag van de composer is
 * alleen goed te beoordelen in een scherm dat ÉXACT is opgebouwd als ChatScreen
 * (navigatie-header + lijst + composer onderaan). Het inlogscherm is daarvoor
 * ongeschikt: daar staat de inhoud gecentreerd, waardoor te veel of te weinig
 * ruimte niet opvalt. Met dit scherm kan het gedrag getest worden zonder in te
 * loggen — handig bij Android-upgrades (edge-to-edge, targetSdk).
 *
 * De schakelaars bovenin wisselen tussen de mogelijke KeyboardAvoidingView-
 * standen, zodat je in één build kunt zien welke stand klopt.
 */
const MODI = [
  { id: 'auto', label: 'auto (meten)', auto: true },
  { id: 'geen', label: 'geen', behavior: undefined, offset: 0 },
  { id: 'padding', label: 'padding', behavior: 'padding', offset: 0 },
  { id: 'padding+offset', label: 'padding+offset', behavior: 'padding', offset: null }, // null = headerHeight
];

export default function LayoutTestScreen() {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const headerHeight = useHeaderHeight();
  const bottomInset = useBottomBarInset();
  const [modusId, setModusId] = useState('auto');
  const [text, setText] = useState('');
  const { ref: kbRef, lift, onLayout: kbLayout } = useKeyboardOverlap();

  const modus = MODI.find((m) => m.id === modusId) || MODI[0];
  const offset = modus.offset === null ? headerHeight : (modus.offset || 0);

  const rijen = Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    tekst: `Testbericht ${i + 1} — zo staat een gewoon bericht in de stroom.`,
  }));

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingBottom: lift }}>
      <View style={[styles.balk, { borderColor: c.border, backgroundColor: c.noteBg }]}>
        {MODI.map((m) => (
          <TouchableOpacity
            key={m.id}
            onPress={() => setModusId(m.id)}
            style={[styles.chip, { borderColor: c.border }, modusId === m.id && { backgroundColor: '#4f46e5' }]}
          >
            <Text style={{ color: modusId === m.id ? '#fff' : c.text, fontSize: 12 }}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: 11, paddingHorizontal: 12, paddingBottom: 4 }}>
        header {Math.round(headerHeight)} · onderinset {Math.round(bottomInset)} · offset {Math.round(offset)} · lift {Math.round(lift)}
      </Text>

      <FlatList
        inverted
        data={rijen}
        keyExtractor={(x) => x.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 6 }}>
            <Text style={{ color: c.text }}>{item.tekst}</Text>
          </View>
        )}
        contentContainerStyle={{ padding: 12 }}
      />

      {/* Exact dezelfde composer-opzet als in ChatScreen. */}
      <View ref={kbRef} onLayout={kbLayout} collapsable={false} style={[styles.composer, { borderColor: c.border, backgroundColor: c.bg, paddingBottom: 8 + bottomInset }]}>
        <TouchableOpacity style={styles.knop}><Feather name="hard-drive" size={20} color={c.muted} /></TouchableOpacity>
        <TouchableOpacity style={styles.knop}><Feather name="file-text" size={20} color={c.muted} /></TouchableOpacity>
        <TouchableOpacity style={styles.knop}><Feather name="check-square" size={20} color={c.muted} /></TouchableOpacity>
        <TextInput
          style={[styles.input, { color: c.text, borderColor: c.border }]}
          value={text}
          onChangeText={setText}
          placeholder="Bericht…"
          placeholderTextColor={c.muted}
          multiline
        />
        <TouchableOpacity style={styles.send}><Feather name="send" size={18} color="#fff" /></TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  balk: { flexDirection: 'row', gap: 6, padding: 8, flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120, fontSize: 15 },
  knop: { paddingHorizontal: 4, paddingVertical: 10, justifyContent: 'center' },
  send: { backgroundColor: '#4f46e5', borderRadius: 18, paddingHorizontal: 18, paddingVertical: 10 },
});
