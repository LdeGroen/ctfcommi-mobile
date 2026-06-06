import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, useColorScheme, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { theme } from '../src/MessageView';
import Avatar from '../src/Avatar';

export default function NewDmScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      try {
        const res = await chat.listUsers(q.trim());
        if (active) setUsers(res.users || []);
      } catch { if (active) setUsers([]); }
    }, 250);
    return () => { active = false; clearTimeout(t); };
  }, [q]);

  const start = async (user) => {
    if (busy) return;
    setBusy(true);
    try {
      const conv = await chat.startDm([user.id]);
      navigation.replace('Chat', { id: conv.id, title: conv.display_name || user.name });
    } catch (e) {
      Alert.alert('Gesprek starten mislukt', e.message || 'Onbekende fout');
      setBusy(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.row, { borderColor: c.border }]} onPress={() => start(item)} disabled={busy}>
      <Avatar name={item.name} size={38} />
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>{item.name || item.email}</Text>
        {item.email ? <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{item.email}</Text> : null}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ padding: 12 }}>
        <View style={[styles.inputWrap, { borderColor: c.border, backgroundColor: dark ? '#111827' : '#f3f4f6' }]}>
          <Feather name="search" size={16} color={c.muted} />
          <TextInput value={q} onChangeText={setQ} autoFocus placeholder="Zoek een collega…" placeholderTextColor={c.muted}
            style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 6 }} />
        </View>
      </View>
      <FlatList
        data={users}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>Geen gebruikers gevonden.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
