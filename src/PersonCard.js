import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Linking, StyleSheet, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from './api';
import Avatar from './Avatar';
import { theme } from './MessageView';

/**
 * Wie is dit? Kaartje bij een naam of avatar.
 *
 * Functie, team en telefoon komen uit Festivalhart (gekoppeld op e-mailadres);
 * wie het in zijn Commi-profiel zelf invult, overschrijft dat.
 */
export default function PersonCard({ userId, onClose, onStartDm }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [profiel, setProfiel] = useState(null);
  const [fout, setFout] = useState(false);

  useEffect(() => {
    let actief = true;
    if (!userId) return undefined;
    chat.userProfile(userId)
      .then((p) => { if (actief) setProfiel(p); })
      .catch(() => { if (actief) setFout(true); });
    return () => { actief = false; };
  }, [userId]);

  const Regel = ({ icoon, tekst, link }) => (
    <TouchableOpacity
      disabled={!link}
      onPress={() => link && Linking.openURL(link).catch(() => {})}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 }}
    >
      <Feather name={icoon} size={15} color={c.muted} />
      <Text style={{ color: link ? '#6366f1' : c.text, flex: 1 }} numberOfLines={1}>{tekst}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={!!userId} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={styles.overlay}>
        <TouchableOpacity activeOpacity={1} style={[styles.kaart, { backgroundColor: c.bg }]}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Avatar name={profiel?.name} uri={profiel?.avatar} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 17 }} numberOfLines={1}>
                {profiel?.name || 'Laden…'}
              </Text>
              {profiel?.status ? <Text style={{ color: c.muted, marginTop: 2 }}>{profiel.status}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={c.muted} />
            </TouchableOpacity>
          </View>

          {fout && <Text style={{ color: c.muted, marginTop: 14 }}>Kon dit profiel niet ophalen.</Text>}

          {profiel && (
            <View style={{ marginTop: 12 }}>
              {profiel.functie ? <Regel icoon="briefcase" tekst={profiel.functie} /> : null}
              {profiel.team ? <Regel icoon="users" tekst={profiel.team} /> : null}
              {profiel.email ? <Regel icoon="mail" tekst={profiel.email} link={`mailto:${profiel.email}`} /> : null}
              {profiel.telefoon ? <Regel icoon="phone" tekst={profiel.telefoon} link={`tel:${profiel.telefoon.replace(/\s/g, '')}`} /> : null}

              {onStartDm && (
                <TouchableOpacity
                  onPress={() => { onStartDm(profiel.id); onClose(); }}
                  style={styles.knop}
                >
                  <Feather name="message-square" size={15} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Bericht sturen</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  kaart: { width: '100%', maxWidth: 380, borderRadius: 18, padding: 18 },
  knop: { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 11 },
});
