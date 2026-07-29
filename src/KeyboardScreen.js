import React from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

/**
 * Schermbodem die meebeweegt met het toetsenbord.
 *
 * Sinds edge-to-edge (targetSdk 36) klopt de KeyboardAvoidingView van React
 * Native zelf niet meer: het venster krimpt op het ene toestel wél en op het
 * andere niet, en de gemelde toetsenbordpositie komt niet overeen met waar het
 * toetsenbord daadwerkelijk staat. Daarom gebruiken we de variant van
 * react-native-keyboard-controller, die de echte toetsenbord-inset rechtstreeks
 * bij Android/iOS opvraagt.
 *
 * Vereist <KeyboardProvider> om de navigatieboom heen (staat in App.js).
 */
export default function KeyboardScreen({ style, offset = 0, children }) {
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={offset} style={style}>
      {children}
    </KeyboardAvoidingView>
  );
}
