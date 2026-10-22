// De tekst die naar de stores gaat, uit CHANGELOG.md. `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stukUitChangelog, naarPlat, kortVoorPlay } from '../scripts/storenotities.mjs';

const CHANGELOG = `# Wat er veranderde

## 0.1.27 — 22 oktober 2026

Meer ruimte om te typen.

- **Eén plusknop.** Alles zit achter de plus,
  zodat het typvak breed is.
- **Foto's toevoegen.** Tot tien tegelijk.

## 0.1.26 — 13 oktober 2026

Polls.
`;

test('pakt alleen het stuk van die versie', () => {
  const stuk = stukUitChangelog(CHANGELOG, '0.1.27');
  assert.ok(stuk.startsWith('Meer ruimte'));
  assert.ok(!stuk.includes('Polls'));
  assert.equal(stukUitChangelog(CHANGELOG, '0.1.26'), 'Polls.');
  assert.equal(stukUitChangelog(CHANGELOG, '0.1.2'), null); // geen half nummer
});

test('platte tekst: geen markdown, punten met •, doorlopende regels samengevoegd', () => {
  const plat = naarPlat(stukUitChangelog(CHANGELOG, '0.1.27'));
  assert.equal(plat, 'Meer ruimte om te typen.\n\n• Eén plusknop. Alles zit achter de plus, zodat het typvak breed is.\n• Foto\'s toevoegen. Tot tien tegelijk.');
});

test('Play: lang stuk wordt de intro plus de koppen, binnen 500 tekens', () => {
  const lang = 'Intro.\n\n' + Array.from({ length: 8 }, (_, i) => `- **Kop ${i}.** ${'woord '.repeat(30)}`).join('\n');
  const kort = kortVoorPlay(lang);
  assert.ok(kort.length <= 500);
  assert.ok(kort.startsWith('Intro.'));
  assert.ok(kort.includes('• Kop 0'));
  assert.ok(!kort.includes('woord'));
});

test('de echte changelog: elke versie geeft bruikbare tekst', () => {
  const c = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const stuk = stukUitChangelog(c, '0.1.27');
  assert.ok(stuk);
  assert.ok(naarPlat(stuk).length <= 4000);
  assert.ok(kortVoorPlay(stuk).length <= 500);
  assert.ok(!/\*\*/.test(naarPlat(stuk)));
});

test('de .p8 wordt gelezen, hoe hij ook in het secret is geplakt', async () => {
  const crypto = await import('node:crypto');
  const { p8NaarPem } = await import('../scripts/storenotities.mjs');
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const kern = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  for (const variant of [pem, pem.replace(/\n/g, '\r\n'), pem.replace(/\n/g, '\n'), kern, ' ' + kern + '\n']) {
    assert.doesNotThrow(() => crypto.createPrivateKey(p8NaarPem(variant)));
  }
});
