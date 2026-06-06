import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from './api';

const cache = new Map();

function domainOf(url) {
  return String(url).replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./, '');
}

// Regex-based (RN's URL is onbetrouwbaar): herken Google Workspace-links.
function googleDoc(url) {
  if (/docs\.google\.com\/document/i.test(url)) return { label: 'Google Document', color: '#4285F4', icon: 'file-text' };
  if (/docs\.google\.com\/spreadsheets/i.test(url)) return { label: 'Google Spreadsheet', color: '#0F9D58', icon: 'grid' };
  if (/docs\.google\.com\/presentation/i.test(url)) return { label: 'Google Presentatie', color: '#F4B400', icon: 'monitor' };
  if (/docs\.google\.com\/forms/i.test(url)) return { label: 'Google Formulier', color: '#7248B9', icon: 'check-square' };
  if (/drive\.google\.com/i.test(url)) return { label: 'Google Drive', color: '#1FA463', icon: 'folder' };
  return null;
}

export default function LinkPreview({ url, c }) {
  const g = googleDoc(url);
  const [data, setData] = useState(() => cache.get(url) || null);
  const [done, setDone] = useState(() => cache.has(url));

  useEffect(() => {
    if (cache.has(url)) return;
    let active = true;
    chat.unfurl(url)
      .then((r) => { if (active) { cache.set(url, r); setData(r); } })
      .catch(() => { if (active) cache.set(url, null); })
      .finally(() => { if (active) setDone(true); });
  }, [url]);

  const open = () => Linking.openURL(url).catch(() => {});

  if (g) {
    return (
      <TouchableOpacity onPress={open} style={[s.card, { borderColor: c.border }]}>
        <View style={[s.badge, { backgroundColor: g.color + '22' }]}><Feather name={g.icon} size={16} color={g.color} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{data?.title || g.label}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{g.label}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (data && (data.title || data.image || data.description)) {
    return (
      <TouchableOpacity onPress={open} style={[s.card, { borderColor: c.border }]}>
        {data.image
          ? <Image source={{ uri: data.image }} style={s.img} />
          : <View style={[s.badge, { backgroundColor: '#e5e7eb' }]}><Feather name="globe" size={16} color="#6b7280" /></View>}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{domainOf(url)}</Text>
          {data.title ? <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{data.title}</Text> : null}
          {data.description ? <Text numberOfLines={2} style={{ color: c.muted, fontSize: 12 }}>{data.description}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  }

  if (!done) return null;

  return (
    <TouchableOpacity onPress={open} style={[s.card, { borderColor: c.border }]}>
      <Feather name="globe" size={16} color={c.muted} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: c.text, fontSize: 14 }}>{domainOf(url)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 8, marginTop: 4 },
  badge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  img: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#e5e7eb' },
});
