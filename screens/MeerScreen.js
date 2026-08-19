import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { logout } from '../src/auth';
import { disconnectEcho } from '../src/echo';
import { chat } from '../src/api';
import Avatar from '../src/Avatar';
import { theme } from '../src/MessageView';

/**
 * Alles wat geen eigen tab kreeg. De tabbalk houdt vijf plekken; wat je minder
 * vaak nodig hebt (overzicht, bewaarde berichten, zoeken, uitloggen) staat hier.
 */
export default function MeerScreen({ navigation, user, onLogout }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);

  // De statusregel die collega's achter je naam zien. Bewust hier en niet in een
  // eigen scherm: het is één regel, en je past hem juist aan als je snel even
  // wilt melden dat je er niet bent.
  const [status, setStatus] = useState(user?.commi_status || '');
  const [bewaard, setBewaard] = useState(user?.commi_status || '');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    setStatus(user?.commi_status || '');
    setBewaard(user?.commi_status || '');
  }, [user?.commi_status]);

  const bewaarStatus = async () => {
    const nieuw = status.trim();
    if (nieuw === bewaard.trim()) return;
    setBezig(true);
    setFout(null);
    try {
      await chat.updateSettings({ commi_status: nieuw || null });
      setBewaard(nieuw);
    } catch (e) {
      setFout('Opslaan mislukt');
      setStatus(bewaard);
    } finally {
      setBezig(false);
    }
  };

  const Item = ({ icoon, titel, uitleg, naar, onPress }) => (
    <TouchableOpacity
      onPress={onPress || (() => navigation.navigate(naar))}
      style={[styles.row, { borderColor: c.border }]}
    >
      <Feather name={icoon} size={20} color={c.text} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>{titel}</Text>
        {uitleg ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }}>{uitleg}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={c.muted} />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[styles.profiel, { borderColor: c.border }]}>
        <Avatar name={user?.name} uri={user?.avatar} size={44} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>{user?.name || 'Onbekend'}</Text>
          <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{user?.email || ''}</Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
        <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>
          Status — staat achter je naam in de chat
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={status}
            onChangeText={setStatus}
            onBlur={bewaarStatus}
            onSubmitEditing={bewaarStatus}
            returnKeyType="done"
            maxLength={140}
            placeholder="Bijv. werkt ma–do · t/m 3 sept afwezig"
            placeholderTextColor={c.muted}
            style={{
              flex: 1, color: c.text, borderWidth: 1, borderColor: c.border,
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
            }}
          />
          {bezig ? <ActivityIndicator style={{ marginLeft: 8 }} /> : null}
        </View>
        {fout ? <Text style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>{fout}</Text> : null}
      </View>

      <Item icoon="search" titel="Zoeken" uitleg="In alle gesprekken" naar="Search" />
      <Item icoon="list" titel="Overzicht" uitleg="Alle berichten en threads — laatste 30 dagen" naar="Activity" />
      <Item icoon="inbox" titel="Nieuw" uitleg="Wat je nog niet gelezen hebt" naar="Nieuw" />
      <Item icoon="bookmark" titel="Bewaren voor later" uitleg="Je bewaarde berichten" naar="Saved" />

      <TouchableOpacity
        onPress={async () => { await logout(); disconnectEcho(); onLogout(); }}
        style={[styles.row, { borderColor: c.border, marginTop: 24 }]}
      >
        <Feather name="log-out" size={20} color="#dc2626" style={{ marginRight: 12 }} />
        <Text style={{ color: '#dc2626', fontWeight: '600', fontSize: 15 }}>Uitloggen</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  profiel: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
