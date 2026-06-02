import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { loginWithGoogle } from '../src/auth';

export default function LoginScreen({ onLoggedIn }) {
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      const ok = await loginWithGoogle();
      if (ok) onLoggedIn();
    } catch (e) {
      Alert.alert('Inloggen mislukt', e.message || 'Onbekende fout');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Image source={require('../assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>CTF Commi</Text>
      <Text style={styles.subtitle}>Het interne berichtenkanaal van Café Theater Festival.</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={busy}>
        {busy ? <ActivityIndicator color="#396971" /> : <Text style={styles.buttonText}>Inloggen met Google</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#396971', alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 96, height: 96, borderRadius: 24, marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  button: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  buttonText: { color: '#396971', fontWeight: '600', fontSize: 16 },
});
