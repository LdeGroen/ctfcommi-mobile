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
export async function shareFromDrive({ conversationId, parentId = null }) {
  const token = await getToken();
  if (!token) return 'cancel';

  const returnUrl = Linking.createURL('drive-done');
  const params = new URLSearchParams({
    api: API_URL,
    t: token,
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
