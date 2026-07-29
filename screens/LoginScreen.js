import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert, KeyboardAvoidingView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { loginWithGoogle, loginWithPassword } from '../src/auth';

export default function LoginScreen({ onLoggedIn }) {
  const [busy, setBusy] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogle = async () => {
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

  const handleEmail = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const ok = await loginWithPassword(email, password);
      if (ok) onLoggedIn();
      else Alert.alert('Inloggen mislukt', 'Controleer je e-mailadres en wachtwoord.');
    } catch (e) {
      Alert.alert('Inloggen mislukt', e.message || 'Onjuiste inloggegevens.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={['#1f3c42', '#2f5860', '#396971']}
      locations={[0, 0.55, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      {/* Edge-to-edge (targetSdk 36): het venster krimpt niet meer voor het
          toetsenbord, dus ook op Android zelf omhoog schuiven. */}
      <KeyboardAvoidingView style={styles.container} behavior="padding">
      <Image source={require('../assets/icon.png')} style={styles.logo} />
      <Text style={styles.title}>CTF Commi</Text>
      <Text style={styles.subtitle}>Het interne berichtenkanaal van Café Theater Festival.</Text>

      <TouchableOpacity style={styles.button} onPress={handleGoogle} disabled={busy}>
        {busy ? <ActivityIndicator color="#396971" /> : <Text style={styles.buttonText}>Inloggen met Google</Text>}
      </TouchableOpacity>

      {!showEmail ? (
        <TouchableOpacity onPress={() => setShowEmail(true)} disabled={busy} style={styles.linkBtn}>
          <Text style={styles.linkText}>Inloggen met e-mail</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.emailBox}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="E-mailadres"
            placeholderTextColor="rgba(255,255,255,0.5)"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Wachtwoord"
            placeholderTextColor="rgba(255,255,255,0.5)"
            secureTextEntry
            editable={!busy}
            onSubmitEditing={handleEmail}
          />
          <TouchableOpacity style={styles.button} onPress={handleEmail} disabled={busy || !email.trim() || !password}>
            {busy ? <ActivityIndicator color="#396971" /> : <Text style={styles.buttonText}>Inloggen</Text>}
          </TouchableOpacity>
        </View>
      )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  logo: { width: 96, height: 96, borderRadius: 24, marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  button: { backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, minWidth: 260, alignItems: 'center' },
  buttonText: { color: '#396971', fontWeight: '600', fontSize: 16 },
  linkBtn: { marginTop: 18, padding: 8 },
  linkText: { color: 'rgba(255,255,255,0.85)', fontSize: 15, textDecorationLine: 'underline' },
  emailBox: { width: '100%', maxWidth: 320, marginTop: 18, gap: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16 },
});
