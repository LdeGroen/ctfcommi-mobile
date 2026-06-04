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

export default function Avatar({ name, uri, size = 36 }) {
  const radius = size / 2;
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: '#e5e7eb' }} />;
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: colorFor(name) }]}>
      <Text style={{ color: '#fff', fontSize: size * 0.42, fontWeight: '700' }}>{initial(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
