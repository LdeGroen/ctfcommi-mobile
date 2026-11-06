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
 * Zelfde functie staat in ctfcommi (src/lib/overzicht.js); verander ze samen.
 */
export function groepeerOverzicht(items) {
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
      // Op id: oplopend in de tijd, en zonder gedoe met tijdzones in de tekst.
      if (m.id > laatsteId) { laatsteId = m.id; laatste = m.created_at || ''; }
      const threadId = m.parent_id || (metAntwoord.has(m.id) ? m.id : null);
      if (!threadId) {
        blokken.push({ sleutel: `b${m.id}`, threadId: null, berichten: [m], volgorde: m.id });
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
      blok.volgorde = Math.max(blok.volgorde, m.id);
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
