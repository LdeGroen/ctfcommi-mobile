import React, { useCallback, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import Avatar from '../src/Avatar';

export default function NieuwScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await chat.listConversations();
      setItems((res.conversations || []).filter((x) => (x.unread_count || 0) > 0));
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const markRead = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    chat.markRead(id).catch(() => {});
  };
  const markAll = () => {
    const ids = items.map((x) => x.id);
    setItems([]);
    ids.forEach((id) => chat.markRead(id).catch(() => {}));
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (items.length ? (
        <TouchableOpacity onPress={markAll}><Text style={{ color: '#fff' }}>Alles gelezen</Text></TouchableOpacity>
      ) : null),
    });
  }, [navigation, items]);

  const renderItem = ({ item }) => {
    const name = item.display_name || item.name || 'Gesprek';
    const isChannel = item.type === 'channel';
    return (
      <View style={[styles.row, { borderColor: c.border }]}>
        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          onPress={() => navigation.navigate('Chat', { id: item.id, title: name })}>
          {item.type === 'dm' && <View style={{ marginRight: 10 }}><Avatar name={name} uri={item.peer_avatar} size={38} /></View>}
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>
              {isChannel && <><Feather name={item.is_private ? 'lock' : 'hash'} size={13} color={c.muted} /> </>}{name}
            </Text>
            {item.last_message?.body ? (
              <Text style={[styles.preview, { color: c.muted }]} numberOfLines={1}>
                {item.last_message.user_name ? `${item.last_message.user_name}: ` : ''}{item.last_message.body}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
        <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count > 99 ? '99+' : item.unread_count}</Text></View>
        <TouchableOpacity onPress={() => markRead(item.id)} hitSlop={8} style={{ marginLeft: 10 }}>
          <Feather name="check" size={22} color="#16a34a" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={items}
      keyExtractor={(x) => String(x.id)}
      renderItem={renderItem}
      ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 60 }}>Je bent helemaal bij 🎉</Text>}
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 16, fontWeight: '600' },
  preview: { fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: '#4f46e5', borderRadius: 12, minWidth: 22, paddingHorizontal: 6, height: 22, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
