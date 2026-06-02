import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_URL, setToken, clearToken } from './api';

WebBrowser.maybeCompleteAuthSession();

// Google-login via de bestaande backend-flow. De backend redirect met
// ?token=... naar onze deeplink (commi://auth of de Expo-dev-URL).
export async function loginWithGoogle() {
  const redirectUri = Linking.createURL('auth');
  const authUrl = `${API_URL}/auth/google?return_to=${encodeURIComponent(redirectUri)}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type !== 'success' || !result.url) return false;

  const { queryParams } = Linking.parse(result.url);
  const pick = (v) => (Array.isArray(v) ? v[0] : v);
  const err = pick(queryParams?.auth_error);
  if (err) throw new Error(decodeURIComponent(err));
  const token = pick(queryParams?.token);
  if (token) { await setToken(token); return true; }
  return false;
}

export async function logout() {
  try { const { apiFetch } = require('./api'); await apiFetch('/api/logout', { method: 'POST' }); } catch {}
  await clearToken();
}
