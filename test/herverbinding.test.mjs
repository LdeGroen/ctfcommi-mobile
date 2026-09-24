// Draaien met `npm test` (node --test). Geen Jest in deze repo: de helper is
// platte JS zonder React Native, dus Node volstaat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bijHerverbinding, voegSamen } from '../src/herverbinding.js';

// Een nagebootste pusher-verbinding: alleen bind/unbind en state.
function nepEcho(state) {
  const luisteraars = [];
  const connection = {
    state,
    bind: (naam, fn) => luisteraars.push(fn),
    unbind: (naam, fn) => { const i = luisteraars.indexOf(fn); if (i >= 0) luisteraars.splice(i, 1); },
  };
  const wissel = (previous, current) => {
    connection.state = current;
    luisteraars.slice().forEach((fn) => fn({ previous, current }));
  };
  return { echo: { connector: { pusher: { connection } } }, wissel, luisteraars };
}

test('de eerste verbinding na het opstarten telt niet als herverbinding', () => {
  const { echo, wissel } = nepEcho('initialized');
  let keer = 0;
  bijHerverbinding(echo, () => { keer += 1; });
  wissel('initialized', 'connecting');
  wissel('connecting', 'connected');
  assert.equal(keer, 0);
  wissel('connected', 'unavailable');
  wissel('unavailable', 'connected');
  assert.equal(keer, 1);
});

test('al verbonden bij het inschrijven: de volgende connected is een herverbinding', () => {
  const { echo, wissel } = nepEcho('connected');
  let keer = 0;
  bijHerverbinding(echo, () => { keer += 1; });
  wissel('connected', 'disconnected');
  wissel('disconnected', 'connecting');
  wissel('connecting', 'connected');
  assert.equal(keer, 1);
});

test('opzeggen haalt de luisteraar weg, en zonder echo gebeurt er niets', () => {
  const { echo, luisteraars } = nepEcho('connected');
  const stop = bijHerverbinding(echo, () => {});
  assert.equal(luisteraars.length, 1);
  stop();
  assert.equal(luisteraars.length, 0);
  assert.doesNotThrow(() => bijHerverbinding(null, () => {})());
});

test('voegSamen: op id, oplopend, zonder dubbelingen', () => {
  const oud = [{ id: 1, body: 'a' }, { id: 3, body: 'c-oud' }];
  const nieuw = [{ id: 3, body: 'c-nieuw' }, { id: 2, body: 'b' }];
  assert.deepEqual(voegSamen(oud, nieuw).map((m) => m.body), ['a', 'b', 'c-nieuw']);
  assert.deepEqual(voegSamen(oud, nieuw, (n, o) => o).map((m) => m.body), ['a', 'b', 'c-oud']);
});
