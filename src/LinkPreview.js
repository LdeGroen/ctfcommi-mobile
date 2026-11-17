import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from './api';

/**
 * Preview-kaartje onder een bericht met een link. 17-11-2026 herzien, samen
 * met LinkPreviewController in ctfbackend: `soort` (pagina/video/audio/
 * afbeelding/pdf), `site_name` en `icon`; YouTube/Vimeo/Spotify via oEmbed.
 * Groot beeld met afspeelknop voor video, plaatje boven de tekst voor een
 * pagina, en een plaatje dat niet laadt verdwijnt.
 * Web: src/components/LinkPreview.jsx in ctfcommi.
 */

const cache = new Map();
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)(\?.*)?$/i;

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
  const isImage = IMG_EXT.test(url);
  const [data, setData] = useState(() => cache.get(url) || null);
  const [done, setDone] = useState(() => cache.has(url));
  const [kapot, setKapot] = useState(false);

  useEffect(() => {
    if (isImage || cache.has(url)) return undefined;
    let active = true;
    chat.unfurl(url)
      .then((r) => { if (active) { cache.set(url, r); setData(r); } })
      .catch(() => { if (active) cache.set(url, null); })
      .finally(() => { if (active) setDone(true); });
    return () => { active = false; };
  }, [url, isImage]);

  const open = () => Linking.openURL(url).catch(() => {});

  const afbeelding = isImage ? url : (data?.soort === 'afbeelding' ? data.image : null);
  if (afbeelding && !kapot) {
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.85} style={{ marginTop: 4 }}>
        <Image source={{ uri: afbeelding }} style={[s.foto, { borderColor: c.border }]} resizeMode="cover" onError={() => setKapot(true)} />
      </TouchableOpacity>
    );
  }

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

  if (data?.soort === 'pdf') {
    return (
      <TouchableOpacity onPress={open} style={[s.card, { borderColor: c.border }]}>
        <View style={[s.badge, { backgroundColor: '#fee2e2' }]}><Feather name="file-text" size={16} color="#dc2626" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{data.title || 'PDF'}</Text>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>PDF · {domainOf(url)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (data && (data.title || data.description || (data.image && !kapot))) {
    const metPlaatje = !!data.image && !kapot;
    const media = data.soort === 'video' || data.soort === 'audio';
    return (
      <TouchableOpacity onPress={open} activeOpacity={0.85} style={[s.groot, { borderColor: c.border }]}>
        {metPlaatje ? (
          <View style={{ backgroundColor: media ? '#000' : c.border }}>
            <Image source={{ uri: data.image }} onError={() => setKapot(true)}
                   style={media ? s.video : s.beeld} resizeMode={data.soort === 'audio' ? 'contain' : 'cover'} />
            {media ? (
              <View style={s.speel} pointerEvents="none">
                <View style={s.speelRond}><Feather name={data.soort === 'audio' ? 'music' : 'play'} size={22} color="#fff" /></View>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={{ padding: 8 }}>
          <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11 }}>{data.site_name || domainOf(url)}</Text>
          {data.title ? <Text numberOfLines={2} style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{data.title}</Text> : null}
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
  groot: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, overflow: 'hidden', marginTop: 4, maxWidth: 420 },
  badge: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  beeld: { width: '100%', height: 150 },
  video: { width: '100%', aspectRatio: 16 / 9 },
  speel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  speelRond: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  foto: { width: 240, height: 180, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
});
