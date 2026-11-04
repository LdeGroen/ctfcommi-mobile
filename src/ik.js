import { useEffect, useState } from 'react';
import { chat } from './api';

/**
 * Wie ben ik? Eén keer per app opgevraagd en daarna onthouden (4-11-2026).
 *
 * Bewerken en verwijderen staan alleen onder je eigen berichten, en daarvoor
 * moet een scherm weten wie jij bent. Het chatscherm vroeg dat bij elk openen
 * zelf op, en slikte een fout: bij slecht bereik bleef het dan onbekend en
 * verscheen Bewerken niet, tot je het gesprek opnieuw opende. Het threadscherm
 * vroeg het helemaal niet. Hier gebeurt het één keer; mislukt het, dan probeert
 * de volgende die het vraagt het opnieuw.
 */
let bekend = null;
let bezig = null;

export function haalIk() {
  if (bekend) return Promise.resolve(bekend);
  if (!bezig) {
    bezig = chat.me()
      .then((ik) => { bekend = ik; return ik; })
      .finally(() => { bezig = null; });
  }
  return bezig;
}

/** Bij uitloggen: anders ziet de volgende gebruiker de vorige als "ik". */
export function vergeetIk() {
  bekend = null;
}

export function useIk() {
  const [ik, setIk] = useState(bekend);
  useEffect(() => {
    if (ik) return undefined;
    let weg = false;
    let poging = null;
    const probeer = () => haalIk()
      .then((x) => { if (!weg) setIk(x); })
      .catch(() => { if (!weg) poging = setTimeout(probeer, 5000); });
    probeer();
    return () => { weg = true; clearTimeout(poging); };
  }, [ik]);
  return ik;
}
