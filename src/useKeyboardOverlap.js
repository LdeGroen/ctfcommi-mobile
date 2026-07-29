import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Houdt de onderste balk (de composer) precies boven het toetsenbord.
 *
 * Waarom meten in plaats van KeyboardAvoidingView?
 * Sinds edge-to-edge (targetSdk 36) verschilt het per toestel/Android-versie
 * hoeveel het systeem zélf al opschuift voor het toetsenbord. Op de Android 15-
 * emulator schuift React Native al een deel op, maar precies één headerhoogte te
 * weinig; op andere toestellen krimpt het venster juist volledig. Elke vaste
 * aanname (behavior/keyboardVerticalOffset) klopt daardoor maar op één van beide.
 *
 * Daarom: meet ná het openen van het toetsenbord waar de composer écht staat en
 * corrigeer het verschil. Blijft er iets over (omdat de correctie zelf de layout
 * verschuift), dan meet onLayout opnieuw en wordt de rest bijgeplust — dat is na
 * één of twee rondjes stabiel. Staat de composer al goed, dan is de correctie 0.
 *
 * Gebruik:
 *   const { ref, lift, onLayout } = useKeyboardOverlap();
 *   <View style={{ flex: 1, paddingBottom: lift }}>
 *     …
 *     <View ref={ref} onLayout={onLayout} collapsable={false}>…composer…</View>
 *   </View>
 */
export function useKeyboardOverlap() {
  const ref = useRef(null);
  const [lift, setLift] = useState(0);
  const kbTop = useRef(null);

  const meet = useCallback(() => {
    const top = kbTop.current;
    const node = ref.current;
    if (top == null || !node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, w, h) => {
      if (!h) return;
      const overschot = Math.round(y + h - top);
      // Alleen bijsturen bij een noemenswaardig verschil, anders blijft het
      // heen en weer schuiven op afrondingsverschillen.
      if (overschot > 1) setLift((l) => l + overschot);
    });
  }, []);

  useEffect(() => {
    const toon = Keyboard.addListener('keyboardDidShow', (e) => {
      const y = e?.endCoordinates?.screenY;
      if (typeof y !== 'number') return;
      kbTop.current = y;
      // Kort wachten zodat de eigen afhandeling van het systeem klaar is.
      setTimeout(meet, 60);
    });
    const verberg = Keyboard.addListener('keyboardDidHide', () => {
      kbTop.current = null;
      setLift(0);
    });
    return () => { toon.remove(); verberg.remove(); };
  }, [meet]);

  return { ref, lift, onLayout: meet };
}
