import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { chat } from '../src/api';
import { logout } from '../src/auth';
import { disconnectEcho } from '../src/echo';

export default function ConversationsScreen({ navigation, onLogout }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await chat.listConversations();
      const list = res.conversations || [];
      setItems(list);
      const total = list.reduce((s, c) => s + (c.unread_count || 0), 0);
      Notifications.setBadgeCountAsync(total).catch(() => {});
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={async () => { await logout(); disconnectEcho(); onLogout(); }}>
          <Text style={{ color: '#fff' }}>Uitloggen</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, onLogout]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const channels = items.filter((x) => x.type === 'channel');
  const dms = items.filter((x) => x.type === 'dm');

  // Secties met koppen, zoals de zijbalk op web/desktop.
  const data = [
    { _section: 'Kanalen' },
    ...channels,
    { _section: 'Directe berichten' },
    ...dms,
  ];

  const renderItem = ({ item }) => {
    if (item._section) {
      return <Text style={[styles.section, { color: c.muted }]}>{item._section.toUpperCase()}</Text>;
    }
    const unread = item.unread_count || 0;
    const name = item.display_name || item.name || 'Gesprek';
    const isChannel = item.type === 'channel';
    return (
      <TouchableOpacity style={[styles.row, { borderColor: c.border }]}
        onPress={() => navigation.navigate('Chat', { id: item.id, title: name })}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text, fontWeight: unread ? '700' : '500' }]} numberOfLines={1}>
            {isChannel && <><Feather name={item.is_private ? 'lock' : 'hash'} size={13} color={c.muted} /> </>}{name}
          </Text>
          {item.last_message?.body ? (
            <Text style={[styles.preview, { color: c.muted }]} numberOfLines={1}>
              {item.last_message.user_name ? `${item.last_message.user_name}: ` : ''}{item.last_message.body}
            </Text>
          ) : null}
        </View>
        {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View>}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={data}
      keyExtractor={(x, i) => (x._section ? `s-${x._section}` : String(x.id))}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <TouchableOpacity onPress={() => navigation.navigate('Activity')} style={[styles.row, { borderColor: c.border }]}>
          <Feather name="list" size={20} color={c.text} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.text, fontWeight: '600' }]}>Overzicht</Text>
            <Text style={[styles.preview, { color: c.muted }]}>Berichten & threads — laatste 30 dagen</Text>
          </View>
        </TouchableOpacity>
      }
      ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Nog geen gesprekken.</Text>}
    />
  );
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 16 },
  preview: { fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: '#4f46e5', borderRadius: 12, minWidth: 22, paddingHorizontal: 6, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
