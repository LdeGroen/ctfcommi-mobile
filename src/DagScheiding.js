import React from 'react';
import { View, Text } from 'react-native';

/**
 * De twee streepjes in een gesprek: een datumlabel per dag, en de grens tussen
 * gelezen en ongelezen. Tegenhanger van `DagScheiding.js` in de webclient; de
 * teksten en de regels om te bepalen wélk label horen hetzelfde te zijn.
 */

// De labels zelf staan in ctf-ui/commi, gedeeld met de webclient (COM-17).
import { dagSleutel, dagLabel } from 'ctf-ui/commi';

export { dagSleutel, dagLabel };

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
