import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Modal, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from './api';

// Polls in Commi (zie ChatPollController in ctfbackend). De stand verschilt
// per kijker en zit daarom niet in het bericht zelf: de kaart haalt hem op,
// en opnieuw zodra item.poll.versie verandert -- dat komt binnen met de gewone
// 'updated'-uitzending van het bericht.

const SOORT_LABEL = { keuze: 'Poll', datum: 'Datumprikker', schaal: 'Beoordeling' };
const DATUM_KNOPPEN = [['ja', 'Ja', 'check', '#16a34a'], ['misschien', '?', 'help-circle', '#f59e0b'], ['nee', 'Nee', 'x', '#6b7280']];
const INDIGO = '#6366f1';

const namenVan = (l) => (l || []).map((s) => s.name).join(', ');

/** "morgen 09:00", "di 3 nov 19:00" */
export function fmtMoment(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Lokale wandtijd voor de backend, zonder tijdzone ('2026-11-02 19:00:00'). */
export function lokaleTijd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

function Balk({ deel, totaal, c }) {
  const pct = totaal > 0 ? Math.round((deel / totaal) * 100) : 0;
  return (
    <View style={[st.balk, { backgroundColor: c.border }]}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: INDIGO }} />
    </View>
  );
}

/**
 * Wie stemde wat, voor één antwoord (22-10-2026). Bij veel stemmers stond dat
 * alleen in een afgekapte regel. groepen: [{ label, namen: [{id, name}] }]
 */
function WieVenster({ wie, onSluit, c }) {
  const groepen = (wie?.groepen || []).filter((g) => g.namen?.length);
  return (
    <Modal visible={!!wie} transparent animationType="fade" onRequestClose={onSluit}>
      <Pressable style={st.achtergrond} onPress={onSluit}>
        <Pressable style={[st.venster, { backgroundColor: c.bg, borderColor: c.border }]} onPress={() => {}}>
          <Text style={[st.vraag, { color: c.text, marginBottom: 6 }]}>{wie?.titel}</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {groepen.length === 0 && <Text style={{ color: c.muted }}>Nog niemand.</Text>}
            {groepen.map((g) => (
              <View key={g.label || 'alle'} style={{ marginTop: 6 }}>
                {!!g.label && <Text style={[st.klein, { color: c.muted, fontWeight: '700', textTransform: 'uppercase' }]}>{g.label} ({g.namen.length})</Text>}
                {[...g.namen].sort((a, b) => a.name.localeCompare(b.name, 'nl')).map((s) => (
                  <Text key={s.id} style={{ color: c.text, fontSize: 15, paddingVertical: 5 }}>{s.name}</Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={onSluit} style={[st.knop, { marginTop: 10 }]}><Text style={st.knopTekst}>Sluiten</Text></TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function PollKaart({ item, c }) {
  const [stand, setStand] = useState(null);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);
  const [keuze, setKeuze] = useState([]);
  const [antwoorden, setAntwoorden] = useState({});
  const [nieuw, setNieuw] = useState('');
  const [toonNiet, setToonNiet] = useState(false);
  const [wie, setWie] = useState(null); // { titel, groepen } voor WieVenster
  const versie = item.poll?.versie;

  const neem = useCallback((s) => {
    setStand(s);
    if (s.soort === 'keuze') setKeuze(s.mijn || []);
    if (s.soort === 'datum') setAntwoorden(s.mijn && !Array.isArray(s.mijn) ? s.mijn : {});
  }, []);

  const laad = useCallback(async () => {
    try { neem(await chat.getPoll(item.id)); setFout(''); }
    catch (e) { setFout(e.message || 'Kon de poll niet laden.'); }
  }, [item.id, neem]);

  useEffect(() => { laad(); }, [laad, versie]);

  // Gaat hij straks vanzelf dicht, ververs dan op dat moment.
  useEffect(() => {
    if (!stand?.sluit_op || stand.gesloten) return undefined;
    const ms = new Date(stand.sluit_op) - Date.now();
    if (ms <= 0 || ms > 2 ** 31 - 1) return undefined;
    const t = setTimeout(laad, ms + 1000);
    return () => clearTimeout(t);
  }, [stand?.sluit_op, stand?.gesloten, laad]);

  const doe = async (fn) => {
    setBezig(true); setFout('');
    try { neem(await fn()); return true; }
    catch (e) { setFout(e.message || 'Dat lukte niet.'); return false; }
    finally { setBezig(false); }
  };

  const kader = [st.kaart, { borderColor: c.border, backgroundColor: c.bg }];
  if (!stand) {
    return (
      <View style={kader}>
        <Text style={[st.vraag, { color: c.text }]}>{item.poll?.vraag || (item.body || '').replace(/^📊\s*/, '')}</Text>
        {fout ? <Text style={st.fout}>{fout}</Text> : <ActivityIndicator size="small" style={{ marginTop: 6 }} />}
      </View>
    );
  }

  const zichtbaar = stand.uitslag_zichtbaar;
  const mag = stand.mag || {};
  const totaal = stand.aantal_stemmers;
  const meta = [
    stand.soort === 'keuze' && stand.meerdere && (stand.max_keuzes ? `kies er hoogstens ${stand.max_keuzes}` : 'meerdere antwoorden'),
    stand.anoniem && 'anoniem',
    !stand.stem_wijzigen && 'stem is definitief',
    stand.resultaten === 'na_stemmen' && 'uitslag na stemmen',
    stand.resultaten === 'na_sluiten' && 'uitslag na sluiten',
    stand.gesloten ? 'gesloten' : (stand.sluit_op && `sluit ${fmtMoment(stand.sluit_op)}`),
  ].filter(Boolean);
  const beste = stand.soort === 'datum' && zichtbaar
    ? (stand.opties || []).reduce((b, o) => (!b || o.ja > b.ja || (o.ja === b.ja && o.misschien > b.misschien) ? o : b), null)
    : null;

  return (
    <View style={kader}>
      <View style={st.kop}>
        <Feather name="bar-chart-2" size={13} color={INDIGO} />
        <Text style={st.soort}>{SOORT_LABEL[stand.soort]}</Text>
        {stand.gesloten && <Feather name="lock" size={12} color={c.muted} style={{ marginLeft: 'auto' }} />}
      </View>
      <Text style={[st.vraag, { color: c.text }]}>{stand.vraag}</Text>
      {meta.length > 0 && <Text style={[st.klein, { color: c.muted }]}>{meta.join(' · ')}</Text>}

      {stand.soort === 'keuze' && stand.opties.map((o) => {
        const gekozen = keuze.includes(o.id);
        const kan = mag.stemmen && !bezig;
        const metNamen = zichtbaar && !stand.anoniem && Array.isArray(o.stemmers);
        const toonWie = () => setWie({ titel: o.tekst, groepen: [{ label: null, namen: o.stemmers || [] }] });
        return (
          <TouchableOpacity key={o.id} disabled={!kan && !metNamen} activeOpacity={0.7}
            // Kun je niet (meer) stemmen, dan laat een tik zien wie dit kozen.
            onPress={() => (!kan ? toonWie() : setKeuze((k) => (!stand.meerdere ? [o.id]
              : k.includes(o.id) ? k.filter((x) => x !== o.id)
                : (stand.max_keuzes && k.length >= stand.max_keuzes ? k : [...k, o.id]))))}
            style={[st.optie, { borderColor: gekozen ? INDIGO : c.border }]}>
            <View style={st.rij}>
              <Feather name={stand.meerdere ? (gekozen ? 'check-square' : 'square') : (gekozen ? 'check-circle' : 'circle')} size={17} color={gekozen ? INDIGO : c.muted} />
              <Text style={{ color: c.text, flex: 1, fontSize: 15 }}>{o.tekst}</Text>
              {zichtbaar && (metNamen && o.aantal > 0
                ? <Text style={[st.klein, st.aantalKnop]} onPress={toonWie} suppressHighlighting={false}>{o.aantal} · {totaal ? Math.round((o.aantal / totaal) * 100) : 0}% ›</Text>
                : <Text style={[st.klein, { color: c.muted }]}>{o.aantal} · {totaal ? Math.round((o.aantal / totaal) * 100) : 0}%</Text>)}
            </View>
            {zichtbaar && <Balk deel={o.aantal} totaal={totaal} c={c} />}
            {zichtbaar && o.stemmers?.length > 0 && <Text numberOfLines={2} style={[st.klein, { color: c.muted, marginTop: 3 }]}>{namenVan(o.stemmers)}</Text>}
          </TouchableOpacity>
        );
      })}
      {stand.soort === 'keuze' && mag.stemmen && (
        <TouchableOpacity disabled={bezig || keuze.length === 0} onPress={() => doe(() => chat.stemPoll(item.id, { keuzes: keuze }))}
          style={[st.knop, (bezig || keuze.length === 0) && { opacity: 0.4 }]}>
          <Text style={st.knopTekst}>{stand.heeft_gestemd ? 'Stem wijzigen' : 'Stem'}</Text>
        </TouchableOpacity>
      )}

      {stand.soort === 'datum' && stand.opties.map((o) => (
        <View key={o.id} style={[st.optie, { borderColor: beste?.id === o.id && beste.ja > 0 ? '#16a34a' : c.border }]}>
          <Text style={{ color: c.text, fontSize: 15, fontWeight: '500' }}
                onPress={zichtbaar && !stand.anoniem && Array.isArray(o.stemmers_ja)
                  ? () => setWie({ titel: o.tekst, groepen: [
                    { label: 'Ja', namen: o.stemmers_ja }, { label: 'Misschien', namen: o.stemmers_misschien }, { label: 'Nee', namen: o.stemmers_nee },
                  ] })
                  : undefined}>
            {o.tekst}{beste?.id === o.id && beste.ja > 0 ? '  ✓ beste optie' : ''}
            {zichtbaar && !stand.anoniem && Array.isArray(o.stemmers_ja) && <Text style={st.aantalKnop}>  wie? ›</Text>}
          </Text>
          <View style={[st.rij, { marginTop: 6 }]}>
            {DATUM_KNOPPEN.map(([k, label, icoon, kleur]) => {
              const actief = antwoorden[o.id] === k;
              return (
                <TouchableOpacity key={k} disabled={!mag.stemmen || bezig} onPress={() => setAntwoorden((a) => ({ ...a, [o.id]: k }))}
                  style={[st.datumKnop, { borderColor: actief ? kleur : c.border, backgroundColor: actief ? kleur : 'transparent' }]}>
                  <Feather name={icoon} size={13} color={actief ? '#fff' : c.muted} />
                  <Text style={{ color: actief ? '#fff' : c.muted, fontSize: 13 }}>{zichtbaar ? o[k] : label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {zichtbaar && o.stemmers_ja?.length > 0 && <Text style={[st.klein, { color: c.muted, marginTop: 3 }]}>✓ {namenVan(o.stemmers_ja)}</Text>}
          {zichtbaar && o.stemmers_misschien?.length > 0 && <Text style={[st.klein, { color: c.muted }]}>? {namenVan(o.stemmers_misschien)}</Text>}
        </View>
      ))}
      {stand.soort === 'datum' && mag.stemmen && (
        <TouchableOpacity disabled={bezig || Object.keys(antwoorden).length === 0} onPress={() => doe(() => chat.stemPoll(item.id, { antwoorden }))}
          style={[st.knop, (bezig || Object.keys(antwoorden).length === 0) && { opacity: 0.4 }]}>
          <Text style={st.knopTekst}>{stand.heeft_gestemd ? 'Bijwerken' : 'Opslaan'}</Text>
        </TouchableOpacity>
      )}

      {stand.soort === 'schaal' && (
        <View style={[st.rij, { flexWrap: 'wrap', marginTop: 8 }]}>
          {Array.from({ length: stand.schaal_max }, (_, i) => i + 1).map((n) => (
            <TouchableOpacity key={n} disabled={!mag.stemmen || bezig} onPress={() => doe(() => chat.stemPoll(item.id, { waarde: n }))}
              style={[st.cijfer, { borderColor: stand.mijn === n ? INDIGO : c.border, backgroundColor: stand.mijn === n ? INDIGO : 'transparent' }]}>
              <Text style={{ color: stand.mijn === n ? '#fff' : c.text, fontWeight: '600' }}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {stand.soort === 'schaal' && zichtbaar && stand.schaal && (
        <Text style={{ color: c.text, marginTop: 6 }}>
          Gemiddeld <Text style={{ fontWeight: '700' }}>{stand.schaal.gemiddelde ?? '—'}</Text> van {stand.schaal_max}
          {!stand.anoniem && stand.schaal.verdeling?.some((v) => v.stemmers?.length) && (
            <Text style={st.aantalKnop} onPress={() => setWie({ titel: stand.vraag, groepen: [...stand.schaal.verdeling].reverse().map((v) => ({ label: String(v.waarde), namen: v.stemmers || [] })) })}>  wie gaf wat? ›</Text>
          )}
        </Text>
      )}

      {!zichtbaar && (
        <Text style={[st.klein, { color: c.muted, fontStyle: 'italic', marginTop: 6 }]}>
          {stand.resultaten === 'na_sluiten' ? 'De uitslag is te zien zodra de poll gesloten is.' : 'De uitslag is te zien zodra je hebt gestemd.'}
        </Text>
      )}

      {mag.optie_toevoegen && stand.soort === 'keuze' && (
        <View style={[st.rij, { marginTop: 8 }]}>
          <TextInput value={nieuw} onChangeText={setNieuw} placeholder="Antwoord toevoegen" placeholderTextColor={c.muted}
            style={[st.invoer, { borderColor: c.border, color: c.text, flex: 1 }]} />
          <TouchableOpacity disabled={bezig || !nieuw.trim()} onPress={async () => { if (await doe(() => chat.pollOptieToevoegen(item.id, { tekst: nieuw.trim() }))) setNieuw(''); }}
            style={[st.klein_knop, { borderColor: c.border }, (!nieuw.trim() || bezig) && { opacity: 0.4 }]}>
            <Feather name="plus" size={16} color={c.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[st.rij, { marginTop: 8, flexWrap: 'wrap' }]}>
        <Text style={[st.klein, { color: c.muted }]}>{totaal} gestemd</Text>
        {stand.niet_gestemd?.length > 0 && (
          <Text style={[st.klein, { color: INDIGO }]} onPress={() => setToonNiet((v) => !v)}>{toonNiet ? 'verberg' : `${stand.niet_gestemd.length} nog niet`}</Text>
        )}
        <View style={{ flex: 1 }} />
        {mag.intrekken && <Text style={[st.klein, { color: c.muted }]} onPress={() => !bezig && doe(() => chat.trekPollStemIn(item.id))}>intrekken</Text>}
        {mag.beheren && (
          <Text style={[st.klein, { color: INDIGO }]} onPress={() => !bezig && doe(() => (stand.gesloten ? chat.heropenPoll(item.id) : chat.sluitPoll(item.id)))}>
            {stand.gesloten ? 'heropenen' : 'sluiten'}
          </Text>
        )}
      </View>
      {toonNiet && stand.niet_gestemd?.length > 0 && <Text style={[st.klein, { color: c.muted }]}>Nog niet gestemd: {namenVan(stand.niet_gestemd)}</Text>}
      {!!fout && <Text style={st.fout}>{fout}</Text>}
      <WieVenster wie={wie} onSluit={() => setWie(null)} c={c} />
    </View>
  );
}

const st = StyleSheet.create({
  kaart: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 4 },
  kop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  soort: { color: INDIGO, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  vraag: { fontSize: 16, fontWeight: '700', marginTop: 3 },
  klein: { fontSize: 12 },
  rij: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optie: { borderWidth: 1, borderRadius: 10, padding: 9, marginTop: 6 },
  balk: { height: 5, borderRadius: 3, overflow: 'hidden', marginTop: 5 },
  knop: { backgroundColor: INDIGO, borderRadius: 10, paddingVertical: 9, alignItems: 'center', marginTop: 8 },
  knopTekst: { color: '#fff', fontWeight: '600' },
  datumKnop: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  cijfer: { width: 38, height: 38, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginBottom: 6 },
  invoer: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14 },
  klein_knop: { borderWidth: 1, borderRadius: 8, padding: 7 },
  fout: { color: '#dc2626', fontSize: 12, marginTop: 4 },
  aantalKnop: { color: INDIGO, fontSize: 12, textDecorationLine: 'underline' },
  achtergrond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  venster: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
});
