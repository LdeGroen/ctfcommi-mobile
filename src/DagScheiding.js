import React from 'react';
import { View, Text } from 'react-native';

/**
 * De twee streepjes in een gesprek: een datumlabel per dag, en de grens tussen
 * gelezen en ongelezen. Tegenhanger van `DagScheiding.js` in de webclient; de
 * teksten en de regels om te bepalen wélk label horen hetzelfde te zijn.
 */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

/** Kale datumsleutel (YYYY-MM-DD) in lokale tijd, om dagen mee te vergelijken. */
export function dagSleutel(iso) {
  // new Date(null) is 1 januari 1970, geen ongeldige datum.
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "Vandaag", "Gisteren", een weekdag, of een volledige datum. */
export function dagLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const vandaag = new Date();
  const kaal = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const verschil = Math.round((kaal(vandaag) - kaal(d)) / 86400000);

  if (verschil === 0) return 'Vandaag';
  if (verschil === 1) return 'Gisteren';

  const dag = DAGEN[d.getDay()];
  const hoofdletter = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  if (verschil > 1 && verschil < 7) return hoofdletter(dag);

  const basis = hoofdletter(`${dag} ${d.getDate()} ${MAANDEN[d.getMonth()]}`);

  return d.getFullYear() === vandaag.getFullYear() ? basis : `${basis} ${d.getFullYear()}`;
}

/** Het datumlabel, als pil op een lijn door het scherm. */
export function DagStreep({ iso, c }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      <View style={{
        borderWidth: 1, borderColor: c.border, borderRadius: 999,
        paddingHorizontal: 10, paddingVertical: 2, marginHorizontal: 8, backgroundColor: c.bg,
      }}>
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>{dagLabel(iso)}</Text>
      </View>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
    </View>
  );
}

/**
 * De grens tussen wat je al had gelezen en wat nieuw is.
 *
 * Rose en niet indigo: indigo is in deze app de kleur van links en van je eigen
 * reactie, en dit is geen knop maar een grens.
 */
export function NieuwStreep({ c }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#fb7185' }} />
      <Text style={{
        color: '#f43f5e', fontSize: 11, fontWeight: '700',
        marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5,
        backgroundColor: c.bg, paddingHorizontal: 4,
      }}>
        Nieuw
      </Text>
    </View>
  );
}
