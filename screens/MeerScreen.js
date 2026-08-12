import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { logout } from '../src/auth';
import { disconnectEcho } from '../src/echo';
import Avatar from '../src/Avatar';
import { theme } from '../src/MessageView';

/**
 * Alles wat geen eigen tab kreeg. De tabbalk houdt vijf plekken; wat je minder
 * vaak nodig hebt (overzicht, bewaarde berichten, zoeken, uitloggen) staat hier.
 */
export default function MeerScreen({ navigation, user, onLogout }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);

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
