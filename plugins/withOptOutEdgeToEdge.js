// Expo config-plugin: zet android:windowOptOutEdgeToEdgeEnforcement in het
// app-thema. Android 15 (targetSdk 35) dwingt "edge-to-edge" af, waardoor
// windowSoftInputMode=adjustResize wordt GENEGEERD: het venster krimpt niet
// meer voor het toetsenbord en het toetsenbord valt over de composer heen
// (en de systeem-navigatiebalk over de onderbalk). Met deze opt-out gedraagt
// het venster zich weer klassiek: resize boven het toetsenbord, venster
// eindigt boven de navigatiebalk — zoals chat-apps horen te werken.
//
// NB: dit attribuut bestaat vanaf API 35 en verdwijnt bij targetSdk 36; tegen
// die tijd is de structurele route een Expo-upgrade met echte edge-to-edge-
// ondersteuning (react-native-edge-to-edge / SDK 53+).
const { withAndroidStyles } = require('@expo/config-plugins');

const ATTR = 'android:windowOptOutEdgeToEdgeEnforcement';

module.exports = function withOptOutEdgeToEdge(config) {
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults;
    for (const style of styles.resources.style || []) {
      // Zowel het hoofdthema als het splash-thema (het eerste venster).
      if (style.$.name === 'AppTheme' || style.$.name === 'Theme.App.SplashScreen') {
        style.item = (style.item || []).filter((i) => i.$.name !== ATTR);
        style.item.push({ $: { name: ATTR }, _: 'true' });
      }
    }
    return config;
  });
};
