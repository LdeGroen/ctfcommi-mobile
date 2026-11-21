// Vaste keuzemomenten voor "later versturen" en "herinner me", en de vorm
// waarin de backend een tijd wil. Zelfde regels als src/lib/tijdstippen.js in
// ctfcommi: als "Morgen" in de ene app 09:00 is en in de andere 08:00, weet
// je niet meer wat je hebt ingesteld (audit COM-17).

/**
 * Lokale wandtijd zonder tijdzone ('2026-11-02 19:00:00'). Bewust géén
 * toISOString(): dat maakt er UTC van, en dan komt een bericht dat je op 09:00
 * zet er 's zomers om 11:00 uit.
 */
export function lokaleTijd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

/**
 * De vier vaste momenten. "Vanavond" schuift naar morgen als het al voorbij is,
 * anders bied je een tijdstip aan dat meteen verstreken is.
 */
export function vasteMomenten() {
  const nu = new Date();
  const overEenUur = new Date(nu.getTime() + 3600 * 1000);
  const vanavond = new Date(nu); vanavond.setHours(18, 0, 0, 0);
  if (vanavond <= nu) vanavond.setDate(vanavond.getDate() + 1);
  const morgen = new Date(nu); morgen.setDate(morgen.getDate() + 1); morgen.setHours(9, 0, 0, 0);
  const week = new Date(nu.getTime() + 7 * 24 * 3600 * 1000);
  return [
    ['Over 1 uur', overEenUur],
    ['Vanavond 18:00', vanavond],
    ['Morgen 09:00', morgen],
    ['Volgende week', week],
  ];
}
