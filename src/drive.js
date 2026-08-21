import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { API_URL, getToken } from './api';

const extra = Constants.expoConfig?.extra || {};
const WEB_URL = (extra.webUrl || 'https://commi.cafetheaterfestival.nl').replace(/\/$/, '');

/**
 * Opent de gehoste Google Picker-pagina in een in-app browser. Die pagina
 * regelt (zo nodig) het koppelen, het kiezen én het delen met de
 * gespreksdeelnemers, en keert daarna terug via de deeplink.
 *
 * @returns {Promise<'shared'|'cancel'|'dismissed'>}
 */
/**
 * Kortlevende toegang voor de pickerpagina.
 *
 * Die pagina kreeg hiervoor het gewone token in zijn URL, en dat leeft een
 * maand. In een in-app browser belandt zo'n URL in de geschiedenis en in
 * verwijzende adressen. Nu een code die één keer werkt en een token oplevert
 * dat na een kwartier vervalt — zelfde flow als web en desktop al gebruiken.
 */
async function haalPickerCode() {
  try {
    const token = await getToken();
    if (!token) return null;

    const res = await fetch(`${API_URL}/api/auth/picker-code`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();

    return json?.code || null;
  } catch {
    return null;
  }
}

export async function shareFromDrive({ conversationId, parentId = null }) {
  const code = await haalPickerCode();
  if (!code) return 'cancel';

  const returnUrl = Linking.createURL('drive-done');
  const params = new URLSearchParams({
    api: API_URL,
    code,
    c: String(conversationId),
    r: returnUrl,
  });
  if (parentId) params.set('p', String(parentId));

  const url = `${WEB_URL}/drive-picker.html?${params.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

  if (result.type !== 'success' || !result.url) return 'dismissed';
  const { queryParams } = Linking.parse(result.url);
  const pick = (v) => (Array.isArray(v) ? v[0] : v);
  return pick(queryParams?.drive) || 'cancel';
}
