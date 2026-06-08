# CTF Commi — mobiele app (Expo / React Native)

iOS + Android client voor de interne chat. Web/desktop = repo `ctfcommi`,
backend (Laravel) = repo `ctfbackend` (zie chat-sectie in die CLAUDE.md).

## Stack
Expo SDK 52 (RN 0.76), React Navigation native-stack, expo-notifications/
secure-store/web-browser/linking, pusher-js (realtime), react-native-markdown-display,
@expo/vector-icons (Feather).

## Builds & store-submit
- **Android (geen EAS-wachtrij):** `.github/workflows/android-gradle.yml` bouwt de
  AAB rechtstreeks met Gradle op een GitHub-runner (`expo prebuild` → `gradlew
  bundleRelease`), signeert met de EAS-keystore (GitHub-secrets `ANDROID_KEYSTORE_BASE64`
  /`_PASSWORD`/`ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD`), en kan met `submit=true`
  via fastlane direct naar de Play **gesloten test-track (alpha)** pushen
  (track staat in `eas.json` → submit.production.android.track). versionCode = epoch/60
  (altijd oplopend). target/compileSdk 35 via `expo-build-properties`.
- **iOS:** via EAS — `.github/workflows/mobile.yml` (`eas build --platform ios
  --profile production --auto-submit`). `eas.json`: ios `image: latest` (iOS 26 SDK),
  submit `ascAppId: 6776176073`. EAS-wachtrij geaccepteerd.
- Na codewijziging is dus een **nieuwe build** nodig om het op het toestel te zien.

## Structuur
| Bestand | Doel |
|---|---|
| `App.js` | auth-gate + navigator; **robuuste notificatie-tik** (cold-start via `getLastNotificationResponseAsync`, navigeer pas als navigator klaar + ingelogd, alles in try/catch); deeplink-token-capture |
| `src/api.js` | token (SecureStore) + `apiFetch` + `chat`-object (incl. `search`) |
| `src/auth.js` | Google-login via `WebBrowser.openAuthSessionAsync` + deeplink |
| `src/push.js` | `registerForPush` + **één** `setNotificationHandler` (SDK52-keys) + Android-kanaal |
| `src/echo.js` | pusher-js realtime singleton (`getEcho`) |
| `src/drive.js` | `shareFromDrive` → opent gehoste picker-pagina (`<webUrl>/drive-picker.html`) in in-app browser, deelt server-side, deeplink terug |
| `src/Avatar.js` | avatar (foto of gekleurde initiaal-cirkel) |
| `src/MessageView.js` | bericht-weergave (avatar, markdown, reacties, thread, drive-bijlage); **`export const theme`** (gedeeld kleurschema — Chat/Thread importeren dit!); component is `React.memo` |
| `screens/ConversationsScreen.js` | lijst met sectiekoppen (Kanalen/DM's), **realtime via `user.{id}`**, avatars bij DM's, zoek-icoon |
| `screens/ChatScreen.js` | gesprek; Drive-knop; zoek-icoon; FlatList-tuning; KeyboardAvoidingView |
| `screens/ThreadScreen.js` | thread (idem) |
| `screens/SearchScreen.js` | zoeken globaal (zonder params) of per gesprek (`conversationId`) |
| `screens/ActivityScreen.js` | overzicht laatste 30 dagen |

## Versiebeleid (AFSPRAAK)
- `versionName` = `app.json` → `expo.version` (handmatig). versionCode loopt
  automatisch op in de Gradle-build (epoch/60).
- **Bij elke nieuwe versie de patch met 1 ophogen** (0.1.1 → 0.1.2 → 0.1.3 …),
  **totdat de gebruiker expliciet zegt dat het 0.2 mag worden.** Houd
  `app.json` en `package.json` in sync. Huidige versie: **0.1.3**.

## Aandachtspunten / valkuilen
- **Feather-iconen (Gradle-build):** in de prebuild/Gradle-build laadt
  `expo-font` het Feather-font niet async → iconen onzichtbaar. NIET oplossen
  met `useFonts`-gate (blokkeert de app op een wit laadscherm). Wél: het font
  **inbedden** via de expo-font-plugin (`fonts: [".../Fonts/Feather.ttf"]`).
- **Toetsenbord:** `app.json` → `android.softwareKeyboardLayoutMode: "pan"` is de
  echte fix (native, werkt pas na rebuild). KeyboardAvoidingView alleen op iOS
  (`behavior padding` + `keyboardVerticalOffset = useHeaderHeight()`); Android `undefined`.
  Niet meer met JS-offsets knutselen — dat vocht tegen de venstermodus.
- **`theme` MOET geëxporteerd blijven** uit `src/MessageView.js`; Chat/ThreadScreen
  doen `import { theme }`. Verdween dit ooit → crash bij openen gesprek.
- **Config:** `app.json` extra: `apiUrl`, `webUrl` (voor de Drive-picker-pagina),
  `pusherKey`, `pusherCluster`, `eas.projectId`.
- Peer-deps die nodig waren: `@react-navigation/elements`, `expo-build-properties`,
  `expo-asset`, `@react-native-community/netinfo`, `expo-font` (via `npx expo install`).

## Wat er gebouwd is (geschiedenis)
Feather-iconen; Google Drive delen (via gehoste picker-pagina); avatars; zoeken
(globaal + per gesprek); sectiekoppen; realtime gesprekkenlijst; scroll-perf
(memo + FlatList-tuning); fixes: notificatie-tik-crash, theme-export-crash,
toetsenbord (pan-modus).
