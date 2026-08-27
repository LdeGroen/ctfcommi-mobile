# CTF Commi — mobiele app (Expo / React Native)

iOS + Android client voor de interne chat. Web/desktop = repo `ctfcommi`,
backend (Laravel) = repo `ctfbackend` (zie chat-sectie in die CLAUDE.md).

## Stack
Expo SDK 54 (RN 0.81, React 19), React Navigation native-stack, expo-notifications/
secure-store/web-browser/linking, pusher-js (realtime), react-native-markdown-display,
@expo/vector-icons (Feather), react-native-keyboard-controller (+ reanimated/worklets)
voor het toetsenbord — zie `src/KeyboardScreen.js`.

## Builds & store-submit
- **Android (geen EAS-wachtrij):** `.github/workflows/android-gradle.yml` bouwt de
  AAB rechtstreeks met Gradle op een GitHub-runner (`expo prebuild` → `gradlew
  bundleRelease`), signeert met de EAS-keystore (GitHub-secrets `ANDROID_KEYSTORE_BASE64`
  /`_PASSWORD`/`ANDROID_KEY_ALIAS`/`ANDROID_KEY_PASSWORD`), en kan met `submit=true`
  via fastlane direct naar de Play **gesloten test-track (alpha)** pushen
  (track staat in `eas.json` → submit.production.android.track). versionCode = epoch/60
  (altijd oplopend). target/compileSdk 35 via `expo-build-properties`.
  De invoer `wat` kiest **aab**, **apk** of **beide**; met *beide* komen ze uit
  dezelfde commit en met hetzelfde versienummer.

### De APK voor wie geen Play Store gebruikt

Een AAB is een pakket voor Google, geen installeerbare app. Wie de Play Store niet
gebruikt kwam er dus niet in. Sinds 27-8-2026 zet `wat=apk` de universele APK ook
op de backend (`POST /api/ops/commi-apk`, secret `OPS_TOKEN`), die hem aanbiedt op
**<https://backend.cafetheaterfestival.nl/commi>** — een pagina met downloadknop en
installatie-uitleg. Een GitHub-artifact volstond niet: die is alleen te halen met
toegang tot deze privé-repo en verdwijnt na negentig dagen.

Drie dingen om te weten:

- **Deze APK en de Play-versie kunnen niet naast elkaar.** Wie een AAB uploadt zit
  verplicht aan Play App Signing, dus Google hertekent het pakket met een andere
  sleutel dan de upload-keystore die deze workflow gebruikt. Android weigert dan de
  installatie over de ander heen. Wisselen betekent eerst verwijderen.
- **De APK werkt zichzelf niet bij.** Er zit geen updatecontrole in de mobiele app
  (anders dan bij desktop). Bij een nieuwe versie draai je `wat=apk` opnieuw en
  installeert de gebruiker er zelf overheen; ingelogd blijven ze.
- **De uploadgrenzen op de server zijn hiervoor opgehoogd** naar 200 MB. Twee
  plekken, en de tweede is een valkuil:
  1. `client_max_body_size` in de nginx-vhost van backend.cafetheaterfestival.nl
     (stond op 64 MB).
  2. **`post_max_size` en `upload_max_filesize` in het `fastcgi_param PHP_VALUE`-blok
     van diezelfde vhost** — niet in `php.ini` en niet in de FPM-pool. CloudPanel
     zet de PHP-instellingen per site daar neer, en die regel wint van allebei.
     Zet je het in de pool, dan zegt `php-fpm -tt` netjes 200M terwijl een verzoek
     gewoon 64M ziet. Te controleren met `ini_get('post_max_size')` in een verzoek
     (`get_cfg_var` geeft de php.ini-waarde en verraadt het verschil).
     Het hoort thuis in **CloudPanel → site → PHP Settings**; met de hand in de
     vhost werkt, maar het paneel kan dat bestand overschrijven.

  De route voor de desktop-installers accepteerde al 200 MB, dus dat gat zat er
  al — het was alleen nog nooit geraakt, want die pakketten zijn klein.
- **iOS (PRIMAIRE route — lokaal op de Mac mini):** `eas build --platform ios --local`
  op de mini, buiten de EAS-cloudwachtrij/limiet om (lokale builds tellen NIET mee voor
  het gratis plan). Zie sectie **"iOS bouwen op de Mac mini"** hieronder. EAS beheert nog
  steeds de credentials (cert + provisioning profile) remote; de lokale build haalt die op.
- **iOS (oude route, cloud):** `.github/workflows/mobile.yml` (`eas build --platform ios
  --profile production --auto-submit`). Werkt, maar gratis cloudbuilds zijn beperkt per
  maand. `eas.json`: ios `image: latest` (iOS 26 SDK), submit `ascAppId: 6776176073`.
- Na codewijziging is dus een **nieuwe build** nodig om het op het toestel te zien.

## iOS bouwen op de Mac mini (primaire route, gratis)

De gratis EAS-cloudbuilds zijn maandelijks beperkt. We bouwen iOS daarom **lokaal op de
Mac mini** (Apple M4) via `eas build --local` — dat telt NIET mee voor het gratis plan en
is snel. De mini is bereikbaar via Tailscale-SSH: `ssh lucdegroen-schram@100.102.177.120`.

### In één commando (na een codewijziging die al naar `main` is gepusht)
```bash
ssh lucdegroen-schram@100.102.177.120 "~/build-ios.sh"
```
`~/build-ios.sh` doet: `git pull` → `npm ci` → `eas build --platform ios --profile
production --local` → `eas submit` naar App Store Connect. Daarna verwerkt Apple de build
(~5-10 min, mail volgt); zichtbaar op App Store Connect / TestFlight (app id 6776176073).
**Push je wijziging dus eerst naar `main`** voordat je het script draait (het pullt).

### Wat er op de mini staat (eenmalig ingericht, juni 2026)
- **Xcode 26.5** (stond er al), **Node 22** (`brew node@22`, keg-only →
  `/opt/homebrew/opt/node@22/bin`), **CocoaPods**, **Fastlane**, **eas-cli** (npm global).
- `~/.ctf-build-env` → `export EXPO_TOKEN=…` (Expo access token; **niet in git**).
- `~/.git-credentials` → GitHub PAT (`repo`-scope) zodat `git pull` van de privé-repo werkt.
- `~/ctfcommi-mobile` → git-clone van deze repo. `~/build-ios.sh` → het buildscript.

### Handmatig (als je stap voor stap wilt)
```bash
ssh lucdegroen-schram@100.102.177.120
export PATH=/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:/usr/bin:/bin
export EAS_NO_VCS=1 LANG=en_US.UTF-8
source ~/.ctf-build-env                 # EXPO_TOKEN
cd ~/ctfcommi-mobile && git pull && npm ci
eas build --platform ios --profile production --local --non-interactive --output ~/build-commi.ipa
eas submit --platform ios --path ~/build-commi.ipa --profile production --non-interactive
```

### Valkuilen / wat we tegenkwamen
- **`EAS_NO_VCS=1`** is nodig als de build vanuit een map zonder/los van git draait
  (anders: "Failed to get Git root path"). Met de git-clone is het verder prima.
- **Node-versie:** pin **Node 22** (Expo SDK 54). Brew installeerde eerst Node 26 → die
  niet gebruiken; vandaar `node@22` met expliciet PATH.
- **Certificaat-conflict (belangrijk):** vindt Xcode nóg een `Apple Distribution:
  Stichting CafeTheaterFestival`-certificaat (ander serienr. dan dat van EAS), dan kiest
  het dat → archive faalt met *"Provisioning profile … doesn't include signing
  certificate …"*. Op de mini zat dat cert **niet** in de login-keychain maar in
  `~/Library/Keychains/chriskatten.keychain-db`, die vóór login in de zoeklijst stond.
  Fix zonder iets weg te gooien — die keychain uit de zoeklijst halen:
  ```bash
  security list-keychains -d user            # controleren wat er in staat
  security list-keychains -d user -s ~/Library/Keychains/login.keychain-db
  ```
  Daarna blijft alleen het EAS-certificaat (in de tijdelijke build-keychain) over.
  Terugzetten kan met hetzelfde commando met beide paden erachter.
  Zoeken waar een cert woont: `security find-certificate -a -c "<naam>" | grep keychain`.
  (De desktop-app gebruikt een **Developer ID**-cert — ander type, blijft in login staan.)
- **buildNumber** wordt door EAS remote automatisch opgehoogd (autoIncrement); geen
  handmatige actie nodig.
- De mini moet wakker + ingelogd zijn (FileVault aan, auto-login uit) en op Tailscale.

## Structuur
| Bestand | Doel |
|---|---|
| `App.js` | auth-gate + navigator; **robuuste notificatie-tik** (cold-start via `getLastNotificationResponseAsync`, navigeer pas als navigator klaar + ingelogd, alles in try/catch); deeplink-token-capture |
| `src/api.js` | token (SecureStore) + `apiFetch` + `chat`-object (incl. `search`) |
| `src/auth.js` | Google-login via `WebBrowser.openAuthSessionAsync` + deeplink |
| `src/push.js` | `registerForPush` + **één** `setNotificationHandler` (SDK52-keys) + Android-kanaal |
| `src/echo.js` | pusher-js realtime singleton (`getEcho`) |
| `src/drive.js` | `shareFromDrive` → opent gehoste picker-pagina (`<webUrl>/drive-picker.html`) in in-app browser, deelt server-side, deeplink terug |
| `src/Avatar.js` | avatar (foto of gekleurde initiaal-cirkel), met groen bolletje als die persoon online is |
| `src/aanwezig.js` | één klok voor de hele app: elke minuut "ik ben er" + wie er nog meer zijn; stopt in de achtergrond |
| `src/UpdateMelding.js` | balk als je een oude versie draait, met een knop naar de store (mobiel kan zichzelf niet installeren) |
| `src/PersonCard.js` | kaartje met contactgegevens bij een naam of avatar |
| `src/MessageView.js` | bericht-weergave (avatar, markdown, reacties, thread, drive-bijlage); **`export const theme`** (gedeeld kleurschema — Chat/Thread importeren dit!); component is `React.memo` |
| `screens/ConversationsScreen.js` | lijst met sectiekoppen (Kanalen/DM's), **realtime via `user.{id}`**, avatars bij DM's, zoek-icoon |
| `screens/ChatScreen.js` | gesprek; Drive-knop; zoek-icoon; FlatList-tuning; KeyboardAvoidingView |
| `screens/ThreadScreen.js` | thread (idem) |
| `screens/SearchScreen.js` | zoeken globaal (zonder params) of per gesprek (`conversationId`) |
| `screens/ActivityScreen.js` | overzicht laatste 30 dagen |

## Uitbrengen en versiebeleid

**Uitbrengen = Actions → "Build & submit mobile (EAS)" → Run workflow → kies
patch/minor/major.** De workflow bepaalt zelf het nieuwe versienummer (het
hoogste van de laatste tag en `app.json`, plus één), zet de tag, vult
`app.json` en `package.json` in, bouwt, dient in en meldt de nieuwe versie aan
de backend. Met de hand taggen of nummers bijwerken hoeft dus niet meer.

- Blijf patch ophogen (0.1.1 → 0.1.2 → …) **totdat de gebruiker zegt dat het
  0.2 mag worden**; kies dan "minor".
- `versionCode` (Android) en `buildNumber` (iOS) lopen automatisch op.
- Kies "geen" als je wilt bouwen zonder het versienummer te verhogen. Let op:
  dan blijft `app.json` staan waar hij staat, dus doe dat niet vlak ná een
  uitgave — dan bouw je het oude nummer opnieuw.
- **Android komt in de gesloten test-track (alpha)**, niet in productie. Doorzetten
  doe je zelf in Play Console. iOS gaat naar App Store Connect.
- Zet de "Wat is er nieuw"-tekst met de hand in beide consoles; EAS stuurt die
  niet mee. De tekst staat klaar in `CHANGELOG.md`.

## Aandachtspunten / valkuilen
- **Feather-iconen (Gradle-build):** in de prebuild/Gradle-build laadt
  `expo-font` het Feather-font niet async → iconen onzichtbaar. NIET oplossen
  met `useFonts`-gate (blokkeert de app op een wit laadscherm). Wél: het font
  **inbedden** via de expo-font-plugin. LET OP: @expo/vector-icons gebruikt
  fontFamily **`feather`** (kleine letter!) en Android matcht op bestandsnaam
  (hoofdlettergevoelig) → embed `assets/fonts/feather.ttf` (kleine letter), niet
  `Feather.ttf`.
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

Later: status bij je naam; personenkaartje; `@persoon`- en `#kanaal`-tags in
berichten (aanklikbaar, `#kanaal` navigeert erheen); melding als je achterloopt;
groen bolletje bij wie nu in de app zit.
