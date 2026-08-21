import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_URL, apiFetch, setToken, clearToken } from './api';

// E-mail/wachtwoord-login (naast Google), voor accounts zonder Google-login —
// o.a. het App Store-review-account en externe testers.
export async function loginWithPassword(email, password) {
  const res = await apiFetch('/api/chat/login', {
    method: 'POST',
    body: JSON.stringify({ email: (email || '').trim().toLowerCase(), password }),
  });
  if (res?.token) { await setToken(res.token); return true; }
  return false;
}

WebBrowser.maybeCompleteAuthSession();

/**
 * Eenmalige inlogcode omwisselen voor het token.
 *
 * De backend stuurt sinds kort een ?code= in plaats van het token zelf; die
 * werkt één keer en vervalt na een minuut. Op een telefoon blijft een deeplink
 * in minder logs hangen dan een webadres, maar dezelfde weg voor alle apps is
 * eenvoudiger te overzien dan een uitzondering.
 */
export async function wisselInlogcodeIn(code) {
  try {
    const res = await fetch(`${API_URL}/api/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return null;
    const json = await res.json();

    return json?.token || null;
  } catch {
    return null;
  }
}

// Google-login via de bestaande backend-flow. De backend redirect met
// ?code=... naar onze deeplink (commi://auth of de Expo-dev-URL).
export async function loginWithGoogle() {
  const redirectUri = Linking.createURL('auth');
  const authUrl = `${API_URL}/auth/google?return_to=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) return false;

  const { queryParams } = Linking.parse(result.url);
  const pick = (v) => (Array.isArray(v) ? v[0] : v);
  const err = pick(queryParams?.auth_error);
  if (err) throw new Error(decodeURIComponent(err));
  // ?token= blijft werken voor een login die al onderweg was toen dit
  // uitrolde; nieuwe logins komen met ?code=.
  const token = pick(queryParams?.token);
  if (token) { await setToken(token); return true; }

  const code = pick(queryParams?.code);
  if (code) {
    const ingewisseld = await wisselInlogcodeIn(code);
    if (ingewisseld) { await setToken(ingewisseld); return true; }
    throw new Error('Deze inlogcode is verlopen of al gebruikt. Probeer opnieuw.');
  }

  return false;
}

export async function logout() {
  try { const { apiFetch } = require('./api'); await apiFetch('/api/logout', { method: 'POST' }); } catch {}
  await clearToken();
}
