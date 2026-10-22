// Zet de releasenotes van een versie uit CHANGELOG.md in de App Store en in
// Google Play. Draait in de release-workflows ná het indienen.
//
//   node scripts/storenotities.mjs ios <versie>
//   node scripts/storenotities.mjs android <versie> <versionCode>
//   node scripts/storenotities.mjs controle   (alleen lezen: werken de sleutels?)
//
// Waarom zelf en niet via EAS: `eas submit` uploadt alleen de app, en EAS
// Metadata kan alleen Apple en stuurt de hele storevermelding mee -- een
// onvolledige config kan daar tekst overschrijven. Dit script raakt alleen het
// veld "Wat is er nieuw".
//
// Sleutels (GitHub-secrets, door Luc zelf ingevuld):
//   ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY   App Store Connect API-sleutel (.p8)
//   PLAY_SERVICE_ACCOUNT_JSON                    Google Play-serviceaccount
// Ontbreekt er een, dan slaat het script over met een waarschuwing. Mislukt
// het, dan ook: notities mogen een uitgave nooit tegenhouden.

import fs from 'node:fs';
import crypto from 'node:crypto';

const APPLE_APP_ID = '6776176073';
const PLAY_PACKAGE = 'nl.cafetheaterfestival.commi';
const PLAY_TRACK = 'alpha';
const PLAY_MAX = 500; // Google Play staat per taal niet meer toe

// ------------------------------------------------------------ de tekst

/** Het stuk van CHANGELOG.md onder "## <versie>", zonder de kop. */
export function stukUitChangelog(changelog, versie) {
  const regels = changelog.replace(/\r\n/g, '\n').split('\n');
  const start = regels.findIndex((r) => r.startsWith(`## ${versie} `) || r === `## ${versie}`);
  if (start < 0) return null;
  const eind = regels.findIndex((r, i) => i > start && r.startsWith('## '));
  return regels.slice(start + 1, eind < 0 ? undefined : eind).join('\n').trim() || null;
}

/** Markdown naar platte tekst zoals de stores hem tonen: alinea's en "•"-punten. */
export function naarPlat(md) {
  // Blokken: een alinea of één punt. Een vervolgregel hoort bij het blok erboven.
  const blokken = [];
  let open = false;
  for (const regel of md.split('\n')) {
    const t = regel.trim();
    if (!t) { open = false; continue; }
    const punt = t.match(/^[-*]\s+(.*)$/);
    if (punt) { blokken.push({ punt: true, tekst: punt[1] }); open = true; }
    else if (open) blokken[blokken.length - 1].tekst += ' ' + t;
    else { blokken.push({ punt: false, tekst: t }); open = true; }
  }
  const schoon = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\s--\s/g, ' – ');
  // Punten direct onder elkaar, verder een witregel tussen de blokken.
  return blokken
    .map((b, i) => (i === 0 ? '' : (b.punt && blokken[i - 1].punt ? '\n' : '\n\n')) + (b.punt ? '• ' : '') + schoon(b.tekst))
    .join('');
}

/**
 * De korte versie voor Google Play (max. 500 tekens): de eerste alinea plus van
 * elk punt alleen de vetgedrukte kop. Past dat nog niet, dan afgekapt op een
 * hele regel.
 */
export function kortVoorPlay(md, max = PLAY_MAX) {
  const vol = naarPlat(md);
  if (vol.length <= max) return vol;

  const regels = md.split('\n');
  const intro = naarPlat(md.split(/\n\s*[-*]\s/)[0]);
  const koppen = regels
    .map((r) => r.trim().match(/^[-*]\s+\*\*(.+?)\*\*/))
    .filter(Boolean)
    .map((m) => '• ' + m[1].replace(/[.:]$/, ''));
  let uit = [intro, ...koppen].join('\n');
  while (uit.length > max && uit.includes('\n')) uit = uit.slice(0, uit.lastIndexOf('\n'));
  return uit.length > max ? uit.slice(0, max - 1) + '…' : uit;
}

// ------------------------------------------------------------ hulp

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function jwt(header, payload, key, alg) {
  const invoer = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const handtekening = alg === 'ES256'
    ? crypto.sign('sha256', Buffer.from(invoer), { key, dsaEncoding: 'ieee-p1363' })
    : crypto.sign('sha256', Buffer.from(invoer), key);
  return `${invoer}.${b64url(handtekening)}`;
}

async function vraag(url, { token, method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const tekst = await res.text();
  if (!res.ok) throw new Error(`${method} ${url.replace(/\?.*/, '')}: HTTP ${res.status} ${tekst.slice(0, 300)}`);
  return tekst ? JSON.parse(tekst) : null;
}

// ------------------------------------------------------------ Apple

// Statussen waarin "Wat is er nieuw" nog te wijzigen is.
const BEWERKBAAR = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY', 'WAITING_FOR_REVIEW'];

const ASC_API = 'https://api.appstoreconnect.apple.com/v1';

function appleToken() {
  const { ASC_ISSUER_ID: iss, ASC_KEY_ID: kid, ASC_PRIVATE_KEY: sleutel } = process.env;
  if (!iss || !kid || !sleutel) return null;
  const nu = Math.floor(Date.now() / 1000);
  return jwt({ alg: 'ES256', kid, typ: 'JWT' }, { iss, iat: nu, exp: nu + 15 * 60, aud: 'appstoreconnect-v1' }, sleutel.replace(/\\n/g, '\n'), 'ES256');
}

async function ios(versie, tekst) {
  const token = appleToken();
  if (!token) return waarschuw('App Store: geen ASC_ISSUER_ID/ASC_KEY_ID/ASC_PRIVATE_KEY, notities overgeslagen.');
  const api = ASC_API;

  const lijst = await vraag(`${api}/apps/${APPLE_APP_ID}/appStoreVersions?filter[platform]=IOS&limit=20`, { token });
  const versies = lijst.data || [];
  let doel = versies.find((v) => v.attributes.versionString === versie);
  if (doel && !BEWERKBAAR.includes(doel.attributes.appStoreState)) {
    return waarschuw(`App Store: versie ${versie} staat op ${doel.attributes.appStoreState}; "Wat is er nieuw" is niet meer te wijzigen.`);
  }
  if (!doel) {
    // Er kan maar één versie tegelijk in voorbereiding zijn. Staat er een met
    // een ander nummer, dan hernoemen -- dat is wat je met de hand ook doet.
    const open = versies.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION');
    doel = open
      ? (await vraag(`${api}/appStoreVersions/${open.id}`, { token, method: 'PATCH',
          body: { data: { type: 'appStoreVersions', id: open.id, attributes: { versionString: versie } } } })).data
      : (await vraag(`${api}/appStoreVersions`, { token, method: 'POST',
          body: { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: versie },
            relationships: { app: { data: { type: 'apps', id: APPLE_APP_ID } } } } } })).data;
  }

  const locs = (await vraag(`${api}/appStoreVersions/${doel.id}/appStoreVersionLocalizations`, { token })).data || [];
  if (!locs.length) return waarschuw('App Store: deze versie heeft geen talen; niets ingevuld.');
  for (const loc of locs) {
    await vraag(`${api}/appStoreVersionLocalizations/${loc.id}`, { token, method: 'PATCH',
      body: { data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { whatsNew: tekst } } } });
    console.log(`App Store ${versie} (${loc.attributes.locale}): "Wat is er nieuw" ingevuld.`);
  }
}

// ------------------------------------------------------------ Google Play

const PLAY_API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/edits`;

async function googleToken() {
  const ruw = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!ruw) return null;
  const sa = JSON.parse(ruw);

  const nu = Math.floor(Date.now() / 1000);
  const assertion = jwt({ alg: 'RS256', typ: 'JWT' },
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: sa.token_uri, iat: nu, exp: nu + 3600 },
    sa.private_key, 'RS256');
  const tok = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error('Google-token mislukt: ' + JSON.stringify(tok).slice(0, 200));
  return tok.access_token;
}

async function android(versie, versionCode, tekst) {
  if (!versionCode) throw new Error('versionCode ontbreekt');
  const token = await googleToken();
  if (!token) return waarschuw('Google Play: geen PLAY_SERVICE_ACCOUNT_JSON, notities overgeslagen.');
  const api = PLAY_API;
  const edit = await vraag(api, { token, method: 'POST', body: {} });
  const track = await vraag(`${api}/${edit.id}/tracks/${PLAY_TRACK}`, { token });
  const release = (track.releases || []).find((r) => (r.versionCodes || []).map(String).includes(String(versionCode)));
  if (!release) return waarschuw(`Google Play: geen release met versionCode ${versionCode} op ${PLAY_TRACK}; niets ingevuld.`);

  release.releaseNotes = [{ language: 'nl-NL', text: tekst }];
  await vraag(`${api}/${edit.id}/tracks/${PLAY_TRACK}`, { token, method: 'PUT', body: track });
  await vraag(`${api}/${edit.id}:commit`, { token, method: 'POST' });
  console.log(`Google Play ${versie} (${versionCode}, ${PLAY_TRACK}): releasenotes ingevuld.`);
}

// ------------------------------------------------------------ start

function waarschuw(tekst) { console.log(`::warning::${tekst}`); }

/** Alleen lezen: kunnen we met de sleutels bij beide stores? Verandert niets. */
async function controle() {
  let goed = true;
  try {
    const token = appleToken();
    if (!token) throw new Error('secrets ontbreken');
    const lijst = await vraag(`${ASC_API}/apps/${APPLE_APP_ID}/appStoreVersions?filter[platform]=IOS&limit=3`, { token });
    console.log('App Store: OK. Laatste versies: ' + (lijst.data || []).map((x) => `${x.attributes.versionString} (${x.attributes.appStoreState})`).join(', '));
  } catch (e) { goed = false; console.log(`::error::App Store: ${e.message}`); }
  try {
    const token = await googleToken();
    if (!token) throw new Error('secret ontbreekt');
    const edit = await vraag(PLAY_API, { token, method: 'POST', body: {} });
    try {
      const track = await vraag(`${PLAY_API}/${edit.id}/tracks/${PLAY_TRACK}`, { token });
      console.log(`Google Play: OK. ${PLAY_TRACK}: ` + (track.releases || []).map((r) => `${r.name || '?'} [${(r.versionCodes || []).join(',')}] ${r.status}${r.releaseNotes ? ' (met notities)' : ''}`).join('; '));
    } finally {
      // Het concept weggooien: een controle hoort niets achter te laten.
      await fetch(`${PLAY_API}/${edit.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    }
  } catch (e) { goed = false; console.log(`::error::Google Play: ${e.message}`); }
  if (!goed) process.exitCode = 1;
}

async function main() {
  const [soort, versie, versionCode] = process.argv.slice(2);
  if (soort === 'controle') return controle();
  if (!['ios', 'android'].includes(soort) || !versie) {
    console.error('gebruik: storenotities.mjs ios <versie> | android <versie> <versionCode>');
    process.exit(2);
  }
  const stuk = stukUitChangelog(fs.readFileSync('CHANGELOG.md', 'utf8'), versie);
  if (!stuk) return waarschuw(`Geen kopje "## ${versie}" in CHANGELOG.md; geen storenotities.`);

  try {
    if (soort === 'ios') await ios(versie, naarPlat(stuk).slice(0, 4000));
    else await android(versie, versionCode, kortVoorPlay(stuk));
  } catch (e) {
    waarschuw(`Storenotities (${soort}) mislukt: ${e.message}`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) main();
