import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, useColorScheme } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { chat } from '../src/api';
import { logout } from '../src/auth';
import { disconnectEcho, getEcho } from '../src/echo';
import Avatar from '../src/Avatar';

export default function ConversationsScreen({ navigation, user, onLogout }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await chat.listConversations();
      const list = res.conversations || [];
      setItems(list);
      const total = list.reduce((s, x) => s + (x.unread_count || 0), 0);
      Notifications.setBadgeCountAsync(total).catch(() => {});
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!user?.id) return;
    let active = true; let sub = null;
    (async () => {
      const echo = await getEcho();
      if (!echo || !active) return;
      const ch = echo.private(`user.${user.id}`);
      const onCreated = (payload) => {
        const cid = payload.conversation_id;
        const msg = payload.message;
        setItems((prev) => {
          const idx = prev.findIndex((x) => x.id === cid);
          if (idx === -1) { load(); return prev; }
          const isMine = msg.user_id === user.id;
          const updated = {
            ...prev[idx],
            last_message: { id: msg.id, body: msg.body, user_id: msg.user_id, user_name: msg.user?.name, created_at: msg.created_at },
            last_message_at: msg.created_at,
            unread_count: isMine ? 0 : (prev[idx].unread_count || 0) + 1,
          };
          const next = [updated, ...prev.filter((_, i) => i !== idx)];
          Notifications.setBadgeCountAsync(next.reduce((s, x) => s + (x.unread_count || 0), 0)).catch(() => {});
          return next;
        });
      };
      // Cross-device: gelezen op een ander apparaat → hier de teller op 0.
      const onRead = (payload) => {
        setItems((prev) => {
          const next = prev.map((x) => (x.id === payload.conversation_id ? { ...x, unread_count: 0 } : x));
          Notifications.setBadgeCountAsync(next.reduce((s, x) => s + (x.unread_count || 0), 0)).catch(() => {});
          return next;
        });
      };
      ch.listen('.chat.message.created', onCreated);
      ch.listen('.chat.conversation.read', onRead);
      sub = { ch, onCreated, onRead };
    })();
    return () => {
      active = false;
      if (sub) {
        try { sub.ch.stopListening('.chat.message.created', sub.onCreated); } catch {}
        try { sub.ch.stopListening('.chat.conversation.read', sub.onRead); } catch {}
      }
    };
  }, [user?.id, load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Nieuw')}>
            <Feather name="inbox" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Search')}>
            <Feather name="search" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await logout(); disconnectEcho(); onLogout(); }}>
            <Text style={{ color: '#fff' }}>Uitloggen</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, onLogout]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const hideConv = (id) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    chat.hideConversation(id).catch(() => {});
  };
  const toggleFav = (id) => {
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_favorite: !x.is_favorite } : x)));
    chat.favoriteConversation(id).catch(() => {});
  };

  const favorites = items.filter((x) => x.is_favorite);
  const channels = items.filter((x) => x.type === 'channel' && !x.is_favorite);
  const dms = items.filter((x) => x.type === 'dm' && !x.is_favorite);

  const data = [
    ...(favorites.length ? [{ _section: 'Favorieten' }, ...favorites] : []),
    { _section: 'Kanalen', _action: 'NewChannel' },
    ...channels,
    { _section: 'Directe berichten', _action: 'NewDm' },
    ...dms,
  ];

  const renderItem = ({ item }) => {
    if (item._section) {
      return (
        <View style={styles.sectionRow}>
          <Text style={[styles.section, { color: c.muted }]}>{item._section.toUpperCase()}</Text>
          {item._action && (
            <TouchableOpacity onPress={() => navigation.navigate(item._action)} hitSlop={10}>
              <Feather name="plus" size={18} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>
      );
    }
    return <Row item={item} c={c} navigation={navigation} onHide={hideConv} onFav={toggleFav} />;
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

// Eén gespreksrij met swipe-acties: rechts swipen = verbergen (alleen DM),
// links swipen = favoriet (DM + channel).
function Row({ item, c, navigation, onHide, onFav }) {
  const ref = useRef(null);
  const unread = item.unread_count || 0;
  const name = item.display_name || item.name || 'Gesprek';
  const isChannel = item.type === 'channel';
  const isDm = item.type === 'dm';

  const close = () => { try { ref.current?.close(); } catch {} };

  // Links-side (zichtbaar bij naar rechts swipen) = Verbergen, alleen voor DM's.
  const renderLeft = isDm && !item.is_self ? () => (
    <View style={[styles.action, { backgroundColor: '#dc2626' }]}>
      <Feather name="eye-off" size={20} color="#fff" />
      <Text style={styles.actionText}>Verberg</Text>
    </View>
  ) : undefined;

  // Rechts-side (zichtbaar bij naar links swipen) = Favoriet.
  const renderRight = () => (
    <View style={[styles.action, { backgroundColor: '#f59e0b' }]}>
      <Feather name="star" size={20} color="#fff" />
      <Text style={styles.actionText}>{item.is_favorite ? 'Verwijder' : 'Favoriet'}</Text>
    </View>
  );

  const onOpen = (direction) => {
    if (direction === 'left' && renderLeft) { close(); onHide(item.id); }
    else if (direction === 'right') { close(); onFav(item.id); }
    else close();
  };

  return (
    <Swipeable ref={ref} renderLeftActions={renderLeft} renderRightActions={renderRight}
               onSwipeableOpen={onOpen} friction={2} leftThreshold={60} rightThreshold={60}>
      <TouchableOpacity style={[styles.row, { backgroundColor: c.bg, borderColor: c.border }]}
        onPress={() => navigation.navigate('Chat', { id: item.id, title: name })}>
        {isDm && <View style={{ marginRight: 10 }}><Avatar name={name} uri={item.peer_avatar} size={38} /></View>}
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: c.text, fontWeight: unread ? '700' : '500' }]} numberOfLines={1}>
            {item.is_favorite ? <><Feather name="star" size={12} color="#f59e0b" /> </> : null}
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
    </Swipeable>
  );
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16, paddingTop: 18, paddingBottom: 6 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 16 },
  preview: { fontSize: 13, marginTop: 2 },
  badge: { backgroundColor: '#4f46e5', borderRadius: 12, minWidth: 22, paddingHorizontal: 6, height: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  action: { width: 88, alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
