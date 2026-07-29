import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard } from 'react-native';

/**
 * Houdt de onderste balk (de composer) precies boven het toetsenbord.
 *
 * Waarom meten in plaats van KeyboardAvoidingView?
 * Sinds edge-to-edge (targetSdk 36) verschilt het per toestel/Android-versie
 * hoeveel het systeem zélf al opschuift voor het toetsenbord: op het ene toestel
 * krimpt het venster volledig, op het andere maar gedeeltelijk. Elke vaste
 * aanname (behavior/keyboardVerticalOffset) klopt daardoor maar op één van beide.
 *
 * Daarom: meet ná het openen van het toetsenbord waar de composer écht staat en
 * corrigeer het verschil. Blijft er iets over (de correctie verschuift de layout
 * zelf ook), dan meet onLayout opnieuw tot het klopt. Staat de composer al goed,
 * dan is de correctie 0.
 *
 * De bovenkant van het toetsenbord wordt berekend als schermhoogte minus
 * toetsenbordhoogte. `endCoordinates.screenY` is onder edge-to-edge niet
 * betrouwbaar: die wordt gemeld ten opzichte van het (niet-gekrompen) venster.
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
  const [diag, setDiag] = useState(null);
  const kbTop = useRef(null);

  const meet = useCallback(() => {
    const top = kbTop.current;
    const node = ref.current;
    if (top == null || !node || typeof node.measureInWindow !== 'function') return;
    node.measureInWindow((x, y, w, h) => {
      if (!h) return;
      const onder = y + h;
      const overschot = Math.round(onder - top);
      setDiag((d) => ({ ...(d || {}), onder: Math.round(onder), top: Math.round(top) }));
      // Alleen bijsturen bij een noemenswaardig verschil, anders blijft het
      // heen en weer schuiven op afrondingsverschillen.
      if (overschot > 1) setLift((l) => l + overschot);
    });
  }, []);

  useEffect(() => {
    const toon = Keyboard.addListener('keyboardDidShow', (e) => {
      const co = e?.endCoordinates;
      if (!co || typeof co.height !== 'number') return;
      const scherm = Dimensions.get('screen').height;
      const venster = Dimensions.get('window').height;
      kbTop.current = scherm - co.height;
      setDiag({ screenY: Math.round(co.screenY ?? -1), kbH: Math.round(co.height), scherm: Math.round(scherm), venster: Math.round(venster) });
      // Kort wachten zodat de eigen afhandeling van het systeem klaar is.
      setTimeout(meet, 80);
    });
    const verberg = Keyboard.addListener('keyboardDidHide', () => {
      kbTop.current = null;
      setLift(0);
    });
    return () => { toon.remove(); verberg.remove(); };
  }, [meet]);

  return { ref, lift, onLayout: meet, diag };
}
