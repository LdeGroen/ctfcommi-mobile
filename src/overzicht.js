/**
 * Het Overzicht per kanaal (6-11-2026).
 *
 * De backend geeft één lijst, nieuwste eerst, over alle gesprekken heen. Dat
 * las als een stapel losse kaartjes waarin je zelf moest uitzoeken wat bij
 * elkaar hoorde. Hier wordt het:
 *
 *   - een groep per gesprek, het gesprek met het nieuwste bericht bovenaan;
 *   - daarbinnen blokken op volgorde van tijd, zoals in het gesprek zelf;
 *   - een blok is een los bericht, of een thread: het startbericht met de
 *     antwoorden daaronder. Het startbericht komt uit de lijst zelf, of anders
 *     uit `parent` dat de backend bij elk antwoord meestuurt (het staat vaak
 *     niet in de lijst: ouder dan 30 dagen, of nog niet geladen).
 *
 * `eerdereAntwoorden` = antwoorden in die thread die hier niet staan.
 *
 * `sleutel` bepaalt de volgorde (standaard het id, dus de tijd van het
 * bericht). Activiteit geeft de tijd van de gebeurtenis mee: een reactie van
 * vandaag op een bericht van vorige week hoort bovenaan.
 * Zelfde functie staat in ctfcommi (src/lib/overzicht.js); verander ze samen.
 */
export function groepeerOverzicht(items, { sleutel = (m) => m.id } = {}) {
  const perGesprek = new Map();
  for (const m of items || []) {
    const conv = m.conversation || { id: m.conversation_id };
    let g = perGesprek.get(conv.id);
    if (!g) {
      g = { conversation: conv, berichten: [] };
      perGesprek.set(conv.id, g);
    }
    g.berichten.push(m);
  }

  const groepen = [];
  for (const g of perGesprek.values()) {
    const metAntwoord = new Set(g.berichten.filter((m) => m.parent_id).map((m) => m.parent_id));
    const threads = new Map();
    const blokken = [];
    let laatste = '';
    let laatsteId = 0;

    for (const m of [...g.berichten].sort((a, b) => a.id - b.id)) {
      // Standaard op id: oplopend in de tijd, zonder gedoe met tijdzones.
      const k = sleutel(m);
      if (k > laatsteId) { laatsteId = k; laatste = m.at || m.created_at || ''; }
      const threadId = m.parent_id || (metAntwoord.has(m.id) ? m.id : null);
      if (!threadId) {
        blokken.push({ sleutel: `b${m.id}`, threadId: null, berichten: [m], volgorde: k });
        continue;
      }
      let blok = threads.get(threadId);
      if (!blok) {
        blok = { sleutel: `t${threadId}`, threadId, start: null, berichten: [], volgorde: 0 };
        threads.set(threadId, blok);
        blokken.push(blok);
      }
      if (m.id === threadId) blok.start = m;
      else {
        blok.berichten.push(m);
        if (!blok.start && m.parent) blok.start = m.parent;
      }
      blok.volgorde = Math.max(blok.volgorde, k);
    }

    for (const blok of threads.values()) {
      const totaal = Number(blok.start?.reply_count) || 0;
      blok.eerdereAntwoorden = Math.max(0, totaal - blok.berichten.length);
    }
    // Een thread staat waar zijn laatste antwoord valt, net als een los bericht.
    blokken.sort((a, b) => a.volgorde - b.volgorde);
    groepen.push({ conversation: g.conversation, blokken, aantal: g.berichten.length, laatste, laatsteId });
  }

  groepen.sort((a, b) => b.laatsteId - a.laatsteId);
  return groepen;
}

/**
 * Activiteit naar berichten (6-11-2026), zodat groepeerOverzicht er kanalen en
 * threads van kan maken. Meer gebeurtenissen bij hetzelfde bericht (twee
 * reacties, of een antwoord waarin je ook genoemd wordt) worden één bericht
 * met meer `redenen`; `at` is de nieuwste.
 */
export function activiteitNaarBerichten(events) {
  const perBericht = new Map();
  for (const e of events || []) {
    const m = e.message;
    if (!m) continue;
    let b = perBericht.get(m.id);
    if (!b) {
      b = { ...m, conversation: e.conversation, redenen: [], at: e.at };
      perBericht.set(m.id, b);
    }
    b.redenen.push({ type: e.type, actor: e.actor, emoji: e.emoji, at: e.at });
    if ((e.at || '') > (b.at || '')) b.at = e.at;
  }
  return [...perBericht.values()];
}

/** Volgorde voor Activiteit: de tijd van de gebeurtenis. */
export const opGebeurtenis = (m) => Date.parse(m.at || m.created_at) || 0;

/**
 * Threads per kanaal (6-11-2026). De backend geeft de threads al op volgorde
 * van laatste antwoord, nieuwste eerst; die volgorde blijft, binnen een kanaal
 * en tussen de kanalen (het kanaal met de nieuwste thread bovenaan).
 */
export function groepeerThreads(items) {
  const perGesprek = new Map();
  for (const t of items || []) {
    const conv = t.conversation || { id: t.conversation_id };
    let g = perGesprek.get(conv.id);
    if (!g) {
      g = { conversation: conv, threads: [], ongelezen: 0 };
      perGesprek.set(conv.id, g);
    }
    g.threads.push(t);
    g.ongelezen += t.unread_reply_count || 0;
  }
  return [...perGesprek.values()];
}
