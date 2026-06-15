import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Linking, Image, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';

const isImage = (mime) => (mime || '').startsWith('image/');
function fmtBytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function iconFor(a) {
  if (a.source === 'drive') return 'hard-drive';
  if ((a.mime || '').includes('pdf')) return 'file-text';
  if (isImage(a.mime)) return 'image';
  return 'paperclip';
}

export default function SharedFilesScreen({ route }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const id = route.params?.id;
  const [files, setFiles] = useState(null);

  useEffect(() => {
    let cancelled = false;
    chat.conversationAttachments(id)
      .then((res) => { if (!cancelled) setFiles(res.attachments || []); })
      .catch(() => { if (!cancelled) setFiles([]); });
    return () => { cancelled = true; };
  }, [id]);

  const renderItem = ({ item }) => (
    <TouchableOpacity style={[styles.row, { borderColor: c.border }]} onPress={() => item.url && Linking.openURL(item.url)}>
      {isImage(item.mime) && item.source !== 'drive' && item.url
        ? <Image source={{ uri: item.url }} style={styles.thumb} />
        : <View style={[styles.thumb, styles.iconBox, { backgroundColor: c.iconBg }]}><Feather name={iconFor(item)} size={20} color={c.muted} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.filename}</Text>
        <Text style={[styles.meta, { color: c.muted }]} numberOfLines={1}>
          {item.user_name ? `${item.user_name} · ` : ''}{fmtDate(item.created_at)}{item.size ? ` · ${fmtBytes(item.size)}` : ''}{item.source === 'drive' ? ' · Drive' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      data={files || []}
      keyExtractor={(x) => String(x.id)}
      renderItem={renderItem}
      ListEmptyComponent={
        <Text style={{ color: c.muted, textAlign: 'center', marginTop: 60 }}>
          {files === null ? 'Laden…' : 'Nog geen bestanden gedeeld in dit gesprek.'}
        </Text>
      }
    />
  );
}

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
  iconBg: dark ? '#1f2937' : '#f3f4f6',
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
});
