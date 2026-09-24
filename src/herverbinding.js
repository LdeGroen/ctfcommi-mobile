// Kopie van ctfcommi/src/lib/herverbinding.js -- houd die twee gelijk.
//
// Na een onderbroken realtime-verbinding (app op de achtergrond, geen bereik)
// maakt Pusher zelf opnieuw verbinding, maar wat er in de tussentijd is
// verstuurd komt niet alsnog binnen. Deze helper roept `fn` aan zodra de
// verbinding terug is, zodat het scherm kan bijhalen wat het miste (audit
// COM-09).
//
// Alleen bij een *her*verbinding: de eerste verbinding na het opstarten gaat
// ook van `connecting` naar `connected`, en dan is er niets gemist -- het
// scherm laadt dan toch al. Staat de verbinding al open op het moment dat je
// je inschrijft, dan telt de eerstvolgende `connected` wel als herverbinding.
//
// Geeft een functie terug die de inschrijving weer opheft.
export function bijHerverbinding(echo, fn) {
  const verbinding = echo?.connector?.pusher?.connection;
  if (!verbinding) return () => {};

  let eerderVerbonden = verbinding.state === 'connected';
  const opWissel = ({ current }) => {
    if (current !== 'connected') return;
    if (eerderVerbonden) fn();
    eerderVerbonden = true;
  };

  verbinding.bind('state_change', opWissel);
  return () => { try { verbinding.unbind('state_change', opWissel); } catch {} };
}

// Twee lijsten berichten samenvoegen op id, oplopend gesorteerd. Een bericht
// dat in allebei staat komt uit `nieuw`; `behoud` beslist per veld wat er van
// de oude versie blijft (bijvoorbeeld de persoonlijke is_saved).
export function voegSamen(oud, nieuw, behoud = (n) => n) {
  const perId = new Map(oud.map((m) => [m.id, m]));
  nieuw.forEach((n) => {
    const o = perId.get(n.id);
    perId.set(n.id, o ? behoud(n, o) : n);
  });
  return Array.from(perId.values()).sort((a, b) => a.id - b.id);
}
