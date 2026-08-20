import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import { Feather } from '@expo/vector-icons';
import { chat } from './api';

/**
 * Draai je nog de nieuwste versie?
 *
 * De backend weet wat er als laatste is uitgebracht. Loop je achter, dan komt
 * er een balkje met een knop naar de store — bijwerken doet de store zelf, dus
 * verder dan erheen sturen komen we niet, en dat hoeft ook niet.
 */

/** Is "gevonden" nieuwer dan "hier"? Per onderdeel als getal vergelijken. */
export const isNieuwer = (gevonden, hier) => {
    const a = String(gevonden || '').split('.').map((n) => parseInt(n, 10) || 0);
    const b = String(hier || '').split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] || 0) > (b[i] || 0)) return true;
        if ((a[i] || 0) < (b[i] || 0)) return false;
    }
    return false;
};

const STORE = {
    android: 'https://play.google.com/store/apps/details?id=nl.cafetheaterfestival.commi',
    ios: 'https://apps.apple.com/app/id6776176073',
};

export default function UpdateMelding({ c }) {
    const [nieuw, setNieuw] = useState(null);

    const hier = Constants.expoConfig?.version || '0.0.0';
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    useEffect(() => {
        let actief = true;
        chat.appVersies()
            .then((alles) => {
                const daar = alles?.[platform];
                if (actief && daar?.versie && isNieuwer(daar.versie, hier)) setNieuw(daar);
            })
            .catch(() => { /* geen verbinding: dan gewoon niets tonen */ });
        return () => { actief = false; };
    }, [platform, hier]);

    if (!nieuw) return null;

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(nieuw.url || STORE[platform])}
            style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: '#4f46e5', paddingHorizontal: 16, paddingVertical: 10,
            }}
        >
            <Feather name="download" size={16} color="#fff" />
            <Text style={{ color: '#fff', flex: 1, fontSize: 13 }} numberOfLines={2}>
                Versie {nieuw.versie} staat klaar — jij draait {hier}. Tik om bij te werken.
            </Text>
            <Feather name="chevron-right" size={18} color="#fff" />
        </TouchableOpacity>
    );
}
