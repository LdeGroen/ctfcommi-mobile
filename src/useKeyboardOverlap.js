import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Geeft terug hoeveel pixels het toetsenbord de onderkant van een container
 * daadwerkelijk overlapt — en dus hoeveel er opgeschoven moet worden.
 *
 * Waarom meten in plaats van KeyboardAvoidingView gebruiken?
 * Sinds edge-to-edge (targetSdk 36) verschilt het per toestel/Android-versie of
 * het venster zélf al krimpt voor het toetsenbord:
 *   - krimpt het venster niet (o.a. de Android 15-emulator) → wij moeten opschuiven;
 *   - krimpt het venster wél (o.a. toestellen in de praktijk) → opschuiven zou een
 *     gat maken ter grootte van de header.
 * KeyboardAvoidingView kan dat verschil niet zien (die meet zijn positie relatief
 * aan de ouder, vandaar de keyboardVerticalOffset-lapmiddelen). Door ná het openen
 * van het toetsenbord de échte overlap te meten, klopt het op beide soorten
 * toestellen zonder aannames.
 *
 * Gebruik:
 *   const { ref, overlap, onLayout } = useKeyboardOverlap();
 *   <View ref={ref} onLayout={onLayout} style={{ flex: 1, paddingBottom: overlap }}>
 */
export function useKeyboardOverlap() {
  const ref = useRef(null);
  const [overlap, setOverlap] = useState(0);

  // Meet de overlap tussen de onderkant van de container en de bovenkant van het
  // toetsenbord. We meten zónder de al toegepaste correctie mee te tellen, zodat
  // herhaald meten niet oploopt.
  const meet = useCallback((kbTop) => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, w, h) => {
      setOverlap((huidig) => {
        const onderkantZonderCorrectie = y + h + huidig;
        return Math.max(0, Math.round(onderkantZonderCorrectie - kbTop));
      });
    });
  }, []);

  useEffect(() => {
    const toon = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbTop = e?.endCoordinates?.screenY;
      if (typeof kbTop !== 'number') return;
      // Kort wachten: sommige toestellen krimpen het venster zelf, dat mag eerst
      // afgerond zijn voordat we meten.
      setTimeout(() => meet(kbTop), 60);
    });
    const verberg = Keyboard.addListener('keyboardDidHide', () => setOverlap(0));
    return () => { toon.remove(); verberg.remove(); };
  }, [meet]);

  // Bij herlayout (bv. draaien) de correctie loslaten; de volgende toetsenbord-
  // gebeurtenis meet opnieuw.
  const onLayout = useCallback(() => {}, []);

  return { ref, overlap, onLayout };
}
