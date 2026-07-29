import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * Schermbodem die meebeweegt met het toetsenbord.
 *
 * Sinds edge-to-edge (targetSdk 36) klopt de KeyboardAvoidingView van React
 * Native zelf niet meer: het venster krimpt op het ene toestel wél en op het
 * andere niet, en de gemelde toetsenbordpositie komt niet overeen met waar het
 * toetsenbord daadwerkelijk staat. Daarom de variant van
 * react-native-keyboard-controller, die de echte toetsenbord-inset rechtstreeks
 * bij Android/iOS opvraagt. Vereist <KeyboardProvider> (staat in App.js).
 *
 * De offset is nodig omdat een scherm mét navigatie-header niet bij y=0 begint.
 * We rekenen die zelf uit (standaard-headerhoogte + bovenste veilige rand) in
 * plaats van useHeaderHeight() te gebruiken: die geeft op Android een waarde in
 * pixels terug, terwijl hier dp verwacht wordt — op een 420dpi-toestel schuift
 * het scherm daardoor 2,6x te ver omhoog.
 */
export default function KeyboardScreen({ style, offset, metHeader = true, children }) {
  const insets = useSafeAreaInsets();
  const standaard = metHeader ? (Platform.OS === 'ios' ? 44 : 56) + insets.top : 0;
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={offset ?? standaard}
      style={style}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
