import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { maakChatApi } from 'ctf-ui/commi';

const extra = Constants.expoConfig?.extra || {};
export const API_URL = extra.apiUrl || 'https://backend.cafetheaterfestival.nl';
export const PUSHER_KEY = extra.pusherKey || '';
export const PUSHER_CLUSTER = extra.pusherCluster || 'eu';

const TOKEN_KEY = 'commi_auth_token';
let cachedToken = null;

export async function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}
export async function setToken(t) { cachedToken = t; await SecureStore.setItemAsync(TOKEN_KEY, t); }
export async function clearToken() { cachedToken = null; await SecureStore.deleteItemAsync(TOKEN_KEY); }

// Wordt aangeroepen zodra de server ons token afwijst. App.js hangt hier het
// terugvallen naar het loginscherm aan; zonder dat merk je pas bij een
// herstart dat je sessie voorbij is.
let bijSessieEinde = null;
export function opSessieVerlopen(fn) { bijSessieEinde = fn; }

export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  // Sanctum-tokens leven een maand. Verlopen of ingetrokken: opruimen en
  // meteen terug naar inloggen.
  if (res.status === 401 && token) {
    await clearToken();
    bijSessieEinde?.();
    const e = new Error('Je sessie is verlopen. Log opnieuw in.');
    e.status = 401;
    throw e;
  }

  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const e = new Error(body?.message || `HTTP ${res.status}`);
    e.status = res.status; e.body = body; throw e;
  }
  return body;
}

// De eindpunten zelf staan in ctf-ui/commi, gedeeld met de webclient (audit
// COM-17, 23-11-2026). Een nieuw eindpunt hoort daar, niet hier. Een bestand
// gaat in React Native als { uri, name, type } in de FormData.
export const chat = maakChatApi(apiFetch, {
  bijlage: (f) => ({ uri: f.uri, name: f.name, type: f.type }),
});
