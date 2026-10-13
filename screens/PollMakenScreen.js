import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert, useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { chat } from '../src/api';
import { theme } from '../src/MessageView';
import { fmtMoment, lokaleTijd } from '../src/Poll';

// Een poll maken (zie ChatPollController in ctfbackend voor de regels).
// Geen native datumkiezer: een moment kies je met pijltjes per dag en een
// tijdveld. Dat scheelt een nieuwe native module, en daarmee een risico bij
// de volgende store-build.

const INDIGO = '#6366f1';

function morgenOm(uur) {
  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(uur, 0, 0, 0);
  return d;
}

/** Eén moment: ◀ di 3 nov ▶ en een tijd (UU:MM). */
function MomentKiezer({ waarde, onChange, c }) {
  const [tijd, setTijd] = useState(`${String(waarde.getHours()).padStart(2, '0')}:${String(waarde.getMinutes()).padStart(2, '0')}`);
  const schuif = (dagen) => { const d = new Date(waarde); d.setDate(d.getDate() + dagen); onChange(d); };
  const zetTijd = (t) => {
    setTijd(t);
    const m = t.match(/^(\d{1,2})[:.](\d{2})$/);
    if (m && +m[1] < 24 && +m[2] < 60) { const d = new Date(waarde); d.setHours(+m[1], +m[2], 0, 0); onChange(d); }
  };
  return (
    <View style={st.rij}>
      <TouchableOpacity onPress={() => schuif(-1)} style={[st.pijl, { borderColor: c.border }]}><Feather name="chevron-left" size={18} color={c.text} /></TouchableOpacity>
      <Text style={{ color: c.text, flex: 1, textAlign: 'center' }}>{waarde.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
      <TouchableOpacity onPress={() => schuif(1)} style={[st.pijl, { borderColor: c.border }]}><Feather name="chevron-right" size={18} color={c.text} /></TouchableOpacity>
      <TextInput value={tijd} onChangeText={zetTijd} keyboardType="numbers-and-punctuation" maxLength={5}
        style={[st.invoer, { borderColor: c.border, color: c.text, width: 70, textAlign: 'center' }]} />
    </View>
  );
}

export default function PollMakenScreen({ route, navigation }) {
  const { convId } = route.params || {};
  const c = theme(useColorScheme() === 'dark');
  const [soort, setSoort] = useState('keuze');
  const [vraag, setVraag] = useState('');
  const [opties, setOpties] = useState(['', '']);
  const [momenten, setMomenten] = useState([morgenOm(19), (() => { const d = morgenOm(19); d.setDate(d.getDate() + 1); return d; })()]);
  const [meerdere, setMeerdere] = useState(false);
  const [maxKeuzes, setMaxKeuzes] = useState('');
  const [schaalMax, setSchaalMax] = useState(5);
  const [anoniem, setAnoniem] = useState(false);
  const [resultaten, setResultaten] = useState('altijd');
  const [wijzigen, setWijzigen] = useState(true);
  const [toevoegen, setToevoegen] = useState(false);
  const [sluitAan, setSluitAan] = useState(false);
  const [sluitOp, setSluitOp] = useState(morgenOm(9));
  const [bezig, setBezig] = useState(false);

  const geldig = useMemo(() => {
    if (!vraag.trim()) return false;
    if (soort === 'schaal') return true;
    if (soort === 'datum') return momenten.length >= 2;
    return opties.filter((o) => o.trim()).length >= 2;
  }, [vraag, soort, opties, momenten]);

  const plaats = async () => {
    setBezig(true);
    try {
      await chat.createPoll(convId, {
        vraag: vraag.trim(), soort,
        opties: soort === 'keuze' ? opties.filter((o) => o.trim()).map((tekst) => ({ tekst: tekst.trim() }))
          : soort === 'datum' ? momenten.map((m) => ({ moment: lokaleTijd(m) })) : [],
        meerdere, max_keuzes: meerdere && maxKeuzes ? Number(maxKeuzes) : null,
        schaal_max: schaalMax, anoniem, resultaten, stem_wijzigen: wijzigen,
        opties_toevoegen: soort !== 'schaal' && toevoegen,
        sluit_op: sluitAan ? lokaleTijd(sluitOp) : null,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Plaatsen mislukt', e.message || '');
      setBezig(false);
    }
  };

  const Schakel = ({ label, aan, zet }) => (
    <View style={[st.rij, st.instelling]}>
      <Text style={{ color: c.text, flex: 1 }}>{label}</Text>
      <Switch value={aan} onValueChange={zet} trackColor={{ true: INDIGO }} />
    </View>
  );
  const Keuzes = ({ waarden, waarde, zet }) => (
    <View style={[st.segment, { borderColor: c.border }]}>
      {waarden.map(([k, label]) => (
        <TouchableOpacity key={String(k)} onPress={() => zet(k)} style={[st.segmentKnop, waarde === k && { backgroundColor: INDIGO }]}>
          <Text style={{ color: waarde === k ? '#fff' : c.text, fontSize: 13 }}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Keuzes waarden={[['keuze', 'Keuze'], ['datum', 'Datumprikker'], ['schaal', 'Beoordeling']]} waarde={soort} zet={setSoort} />

      <TextInput value={vraag} onChangeText={setVraag} maxLength={500} autoFocus
        placeholder={soort === 'datum' ? 'Waarvoor zoek je een moment?' : soort === 'schaal' ? 'Wat moeten mensen beoordelen?' : 'Je vraag'}
        placeholderTextColor={c.muted} style={[st.invoer, st.vraag, { borderColor: c.border, color: c.text }]} />

      {soort === 'keuze' && (
        <>
          {opties.map((o, i) => (
            <View key={i} style={[st.rij, { marginTop: 8 }]}>
              <TextInput value={o} onChangeText={(t) => setOpties((l) => l.map((x, j) => (j === i ? t : x)))} maxLength={200}
                placeholder={`Antwoord ${i + 1}`} placeholderTextColor={c.muted} style={[st.invoer, { borderColor: c.border, color: c.text, flex: 1 }]} />
              {opties.length > 2 && <TouchableOpacity onPress={() => setOpties((l) => l.filter((_, j) => j !== i))}><Feather name="x" size={18} color={c.muted} /></TouchableOpacity>}
            </View>
          ))}
          <View style={[st.rij, { marginTop: 8, gap: 16 }]}>
            {opties.length < 30 && <Text style={{ color: INDIGO }} onPress={() => setOpties((l) => [...l, ''])}>+ antwoord</Text>}
            <Text style={{ color: c.muted }} onPress={() => setOpties(['Ja', 'Nee'])}>Ja / Nee</Text>
            <Text style={{ color: c.muted }} onPress={() => setOpties(['Ja', 'Nee', 'Misschien'])}>Ja / Nee / Misschien</Text>
          </View>
        </>
      )}

      {soort === 'datum' && (
        <>
          {momenten.map((m, i) => (
            <View key={i} style={[st.rij, { marginTop: 8 }]}>
              <View style={{ flex: 1 }}><MomentKiezer waarde={m} onChange={(d) => setMomenten((l) => l.map((x, j) => (j === i ? d : x)))} c={c} /></View>
              {momenten.length > 2 && <TouchableOpacity onPress={() => setMomenten((l) => l.filter((_, j) => j !== i))}><Feather name="x" size={18} color={c.muted} /></TouchableOpacity>}
            </View>
          ))}
          {momenten.length < 30 && (
            <Text style={{ color: INDIGO, marginTop: 8 }} onPress={() => setMomenten((l) => { const d = new Date(l[l.length - 1]); d.setDate(d.getDate() + 1); return [...l, d]; })}>+ moment</Text>
          )}
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{momenten.map((m) => fmtMoment(m.toISOString())).join(' · ')}</Text>
        </>
      )}

      {soort === 'schaal' && (
        <View style={{ marginTop: 12 }}>
          <Keuzes waarden={[[5, '1 tot 5'], [10, '1 tot 10']]} waarde={schaalMax} zet={setSchaalMax} />
        </View>
      )}

      <View style={[st.blok, { borderColor: c.border }]}>
        {soort === 'keuze' && <Schakel label="Meerdere antwoorden toestaan" aan={meerdere} zet={setMeerdere} />}
        {soort === 'keuze' && meerdere && (
          <View style={[st.rij, st.instelling]}>
            <Text style={{ color: c.text, flex: 1 }}>Hoogstens (leeg = geen maximum)</Text>
            <TextInput value={maxKeuzes} onChangeText={(t) => setMaxKeuzes(t.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={2}
              style={[st.invoer, { borderColor: c.border, color: c.text, width: 56, textAlign: 'center' }]} />
          </View>
        )}
        <Schakel label="Anoniem" aan={anoniem} zet={setAnoniem} />
        <Schakel label="Stem wijzigen toestaan" aan={wijzigen} zet={setWijzigen} />
        {soort !== 'schaal' && <Schakel label="Iedereen mag antwoorden toevoegen" aan={toevoegen} zet={setToevoegen} />}
        <Text style={{ color: c.text, marginTop: 10, marginBottom: 6 }}>Uitslag zichtbaar</Text>
        <Keuzes waarden={[['altijd', 'Altijd'], ['na_stemmen', 'Na stemmen'], ['na_sluiten', 'Na sluiten']]} waarde={resultaten} zet={setResultaten} />
        <Schakel label="Automatisch sluiten" aan={sluitAan} zet={setSluitAan} />
        {sluitAan && <MomentKiezer waarde={sluitOp} onChange={setSluitOp} c={c} />}
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>Wie de poll maakt of het kanaal beheert ziet de uitslag altijd en kan hem sluiten en heropenen.</Text>
      </View>

      <TouchableOpacity disabled={!geldig || bezig} onPress={plaats} style={[st.knop, (!geldig || bezig) && { opacity: 0.4 }]}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{bezig ? 'Plaatsen…' : 'Poll plaatsen'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  rij: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  invoer: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  vraag: { marginTop: 12, fontSize: 16 },
  pijl: { borderWidth: 1, borderRadius: 8, padding: 6 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  segmentKnop: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  blok: { borderTopWidth: 1, marginTop: 16, paddingTop: 8 },
  instelling: { paddingVertical: 6 },
  knop: { backgroundColor: INDIGO, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
});
