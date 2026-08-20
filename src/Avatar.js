import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

// Vaste set rustige kleuren; gekozen op basis van de naam zodat dezelfde
// persoon altijd dezelfde kleur krijgt.
const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function colorFor(name) {
  const s = String(name || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function initial(name) {
  const t = String(name || '').trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

export default function Avatar({ name, uri, size = 36, online = false }) {
  const radius = size / 2;

  const beeld = uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#e5e7eb' }} />
    : (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(name) }]}>
        <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{initial(name)}</Text>
      </View>
    );

  if (!online) return beeld;

  // Het bolletje schaalt mee: een vaste maat zou op een klein plaatje het
  // halve gezicht bedekken. Het witte randje houdt het leesbaar op een
  // donkere foto.
  const stip = Math.max(8, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size }}>
      {beeld}
      <View style={{
        position: 'absolute', right: -1, bottom: -1,
        width: stip, height: stip, borderRadius: stip / 2,
        backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff',
      }} />
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
