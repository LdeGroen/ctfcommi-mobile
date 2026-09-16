/**
 * "sinds 3 dagen" in plaats van een datum.
 *
 * De vraag bij een gedempt gesprek is niet wánneer je hem dempte maar hoe lang
 * het al duurt -- dat is waar je op afhaakt. Zelfde bewoordingen als in de
 * webclient (`ChatWindow.js`); houd ze gelijk.
 */
export function gedemptSinds(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const uren = Math.floor((Date.now() - d.getTime()) / 3600000);
  if (uren < 1) return 'zojuist';
  if (uren < 24) return `${uren} uur`;
  const dagen = Math.floor(uren / 24);
  if (dagen === 1) return 'gisteren';
  if (dagen < 31) return `${dagen} dagen`;
  const maanden = Math.round(dagen / 30);

  return maanden === 1 ? 'een maand' : `${maanden} maanden`;
}
