import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Modal, Pressable, ScrollView, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';

/**
 * Het plusmenu naast het typvak en de foto's en video's die met een bericht
 * meegaan. Gedeeld door het chatscherm en de thread, zodat die twee niet uit
 * elkaar lopen (22-10-2026).
 */

// De server neemt tot 10 bijlagen van elk 50 MB aan (attachments.* max:51200).
// Te groot wordt hier al tegengehouden: anders wacht je op een upload die
// daarna toch wordt geweigerd.
const MAX_BIJLAGEN = 10;
const MAX_GROOTTE = 50 * 1024 * 1024;

/** Eerst het menu dicht, dan pas de kiezer: op iOS weigert een tweede venster
 *  te openen zolang het eerste nog aan het verdwijnen is. */
export const naMenu = (sluit, fn) => { sluit(); setTimeout(fn, 350); };

/** { bijlagen, setBijlagen, kiesUitBibliotheek, maakMetCamera } */
export function useMediaBijlagen() {
  const [bijlagen, setBijlagen] = useState([]);

  const voegToe = (assets) => {
    const teGroot = assets.filter((x) => x.fileSize && x.fileSize > MAX_GROOTTE);
    const nieuw = assets.filter((x) => !teGroot.includes(x)).map((x, i) => {
      const video = x.type === 'video';
      return {
        uri: x.uri,
        name: x.fileName || `${video ? 'video' : 'foto'}-${Date.now()}-${i}.${video ? 'mp4' : 'jpg'}`,
        type: x.mimeType || (video ? 'video/mp4' : 'image/jpeg'),
        video,
      };
    });
    const ruimte = MAX_BIJLAGEN - bijlagen.length;
    setBijlagen((prev) => [...prev, ...nieuw].slice(0, MAX_BIJLAGEN));
    const meldingen = [];
    if (teGroot.length) meldingen.push(`${teGroot.length} bestand${teGroot.length === 1 ? ' is' : 'en zijn'} groter dan 50 MB en niet toegevoegd.`);
    if (nieuw.length > ruimte) meldingen.push(`Er kunnen er ${MAX_BIJLAGEN} tegelijk mee; de rest is niet toegevoegd.`);
    if (meldingen.length) Alert.alert('Niet alles toegevoegd', meldingen.join('\n'));
  };

  const kiesUitBibliotheek = async () => {
    const ruimte = MAX_BIJLAGEN - bijlagen.length;
    if (ruimte <= 0) { Alert.alert('Vol', `Er kunnen ${MAX_BIJLAGEN} bijlagen tegelijk mee.`); return; }
    try {
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: ruimte,
        quality: 0.8,
        // HEIC en HEVC omzetten naar JPEG en H.264, zodat iedereen ze kan openen.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (!r.canceled) voegToe(r.assets || []);
    } catch (e) { Alert.alert('Kon de fotobibliotheek niet openen', e?.message || ''); }
  };

  const maakMetCamera = async () => {
    try {
      const toestemming = await ImagePicker.requestCameraPermissionsAsync();
      if (!toestemming.granted) {
        Alert.alert('Geen toegang tot de camera', 'Zet de toegang aan bij de instellingen van je telefoon, onder Commi.');
        return;
      }
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
      if (!r.canceled) voegToe(r.assets || []);
    } catch (e) { Alert.alert('Kon de camera niet openen', e?.message || ''); }
  };

  return { bijlagen, setBijlagen, kiesUitBibliotheek, maakMetCamera };
}

/** De tegeltjes boven het typvak, met een kruisje per stuk. */
export function BijlagenRij({ bijlagen, setBijlagen, c, dark }) {
  if (!bijlagen.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rij}>
      {bijlagen.map((b, i) => (
        <View key={b.uri + i} style={[s.tegel, { borderColor: c.border }]}>
          {b.video ? (
            <View style={[s.video, { backgroundColor: dark ? '#1f2937' : '#e5e7eb' }]}>
              <Feather name="video" size={22} color={c.muted} />
            </View>
          ) : (
            <Image source={{ uri: b.uri }} style={s.foto} />
          )}
          <TouchableOpacity style={s.weg} hitSlop={8} accessibilityLabel="Bijlage weghalen"
                            onPress={() => setBijlagen((prev) => prev.filter((_, j) => j !== i))}>
            <Feather name="x" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}

/** De plusknop zelf. Geel als er iets aanstaat dat je niet moet vergeten. */
export function PlusKnop({ onPress, c, actief = false }) {
  return (
    <TouchableOpacity style={s.plus} onPress={onPress} accessibilityLabel="Meer: foto's, camera, Drive en meer">
      <Feather name="plus-circle" size={26} color={actief ? '#f59e0b' : c.muted} />
    </TouchableOpacity>
  );
}

/** Het menu dat omhoog schuift. regels: [{ icoon, label, doe, uit?, kleur?, toelichting? }] */
export function PlusMenu({ open, onSluit, regels, c, bottomInset = 0 }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onSluit}>
      <Pressable style={s.achtergrond} onPress={onSluit}>
        <Pressable style={[s.vel, { backgroundColor: c.bg, borderColor: c.border, paddingBottom: 12 + bottomInset }]} onPress={() => {}}>
          {regels.map((r) => (
            <TouchableOpacity key={r.label} style={[s.regel, r.uit && { opacity: 0.4 }]} onPress={r.doe} disabled={r.uit}>
              <Feather name={r.icoon} size={20} color={r.kleur || c.text} />
              <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{r.label}</Text>
              {!!r.toelichting && <Text style={{ color: c.muted, fontSize: 12 }}>{r.toelichting}</Text>}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  plus: { paddingHorizontal: 4, paddingVertical: 8, justifyContent: 'center' },
  achtergrond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  vel: { width: '100%', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 20 },
  regel: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 },
  rij: { gap: 8, paddingHorizontal: 10, paddingTop: 10 },
  tegel: { width: 64, height: 64, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  video: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  weg: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
