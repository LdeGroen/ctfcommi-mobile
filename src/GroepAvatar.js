import React from 'react';
import { View, Text, Image } from 'react-native';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];
function colorFor(name) {
  const s = String(name || '?');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

function Bolletje({ lid, maat }) {
  const stijl = { width: maat, height: maat, borderRadius: maat / 2, borderWidth: 1, borderColor: '#fff' };
  if (lid.avatar) return <Image source={{ uri: lid.avatar }} style={[stijl, { backgroundColor: '#e5e7eb' }]} />;
  return (
    <View style={[stijl, { backgroundColor: colorFor(lid.name), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#fff', fontSize: maat * 0.5, fontWeight: '700' }}>
        {String(lid.name || '?').trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/**
 * Groepsgesprek (10-11-2026): kleine bolletjes van de anderen in de ruimte van
 * een gewone avatar. Drie: twee boven, één onder; vier: twee bij twee; meer
 * dan vier: vier plus een "+". Zelfde component staat in ctfcommi
 * (src/components/GroepAvatar.js); verander ze samen.
 */
export default function GroepAvatar({ leden = [], anderen = 0, size = 38 }) {
  const maat = Math.floor(size / 2);
  const vier = leden.slice(0, 4);
  const plus = Math.max(14, Math.round(size * 0.4));
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center' }}>
        {vier.map((l, i) => <Bolletje key={i} lid={l} maat={maat} />)}
      </View>
      {anderen > 4 && (
        <View style={{
          position: 'absolute', right: -3, bottom: -3, width: plus, height: plus, borderRadius: plus / 2,
          backgroundColor: '#374151', borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: plus * 0.7, fontWeight: '700', lineHeight: plus * 0.85 }}>+</Text>
        </View>
      )}
    </View>
  );
}
