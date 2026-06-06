import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet, useColorScheme, Alert, ScrollView } from 'react-native';
import { chat } from '../src/api';
import { theme } from '../src/MessageView';

export default function NewChannelScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const n = name.trim();
    if (!n || saving) return;
    setSaving(true);
    try {
      const conv = await chat.createChannel({ name: n, description: description.trim() || null, is_private: isPrivate });
      navigation.replace('Chat', { id: conv.id, title: conv.display_name || conv.name || n });
    } catch (e) {
      Alert.alert('Aanmaken mislukt', e.message || 'Onbekende fout');
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: c.muted }]}>Kanaalnaam</Text>
      <TextInput value={name} onChangeText={setName} autoFocus placeholder="bijv. marketing" placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, borderColor: c.border }]} />

      <Text style={[styles.label, { color: c.muted }]}>Omschrijving (optioneel)</Text>
      <TextInput value={description} onChangeText={setDescription} placeholder="Waar gaat dit kanaal over?" placeholderTextColor={c.muted}
        multiline style={[styles.input, { color: c.text, borderColor: c.border, minHeight: 70, textAlignVertical: 'top' }]} />

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '600' }}>Privékanaal</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>Alleen leden die je toevoegt kunnen het zien.</Text>
        </View>
        <Switch value={isPrivate} onValueChange={setIsPrivate} />
      </View>

      <TouchableOpacity onPress={create} disabled={!name.trim() || saving}
        style={[styles.btn, (!name.trim() || saving) && { opacity: 0.4 }]}>
        <Text style={styles.btnText}>{saving ? 'Aanmaken…' : 'Kanaal aanmaken'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 12 },
  btn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 28 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
