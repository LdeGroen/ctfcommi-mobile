import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Ruimte die onder de onderste balk (bv. de composer) moet komen zodat die niet
 * onder de Android-systeemnavigatiebalk (gebaren/3-knops) valt.
 *
 * = de bottom safe-area-inset van het toestel (0 op toestellen zónder zo'n balk,
 *   dus geen verspilde ruimte), maar 0 zodra het toetsenbord open is: de app
 *   pant dan al omhoog (adjustPan) en de inset zou een lelijke gap boven het
 *   toetsenbord geven.
 */
export function useBottomBarInset() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return keyboardOpen ? 0 : insets.bottom;
}
