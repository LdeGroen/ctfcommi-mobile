import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { chat, getToken, setToken, opSessieVerlopen } from './src/api';
import { registerForPush } from './src/push';
import LoginScreen from './screens/LoginScreen';
import ConversationsScreen from './screens/ConversationsScreen';
import ChatScreen from './screens/ChatScreen';
import ThreadScreen from './screens/ThreadScreen';
import ActivityScreen from './screens/ActivityScreen';
import SearchScreen from './screens/SearchScreen';
import NewChannelScreen from './screens/NewChannelScreen';
import NewDmScreen from './screens/NewDmScreen';
import NieuwScreen from './screens/NieuwScreen';
import SharedFilesScreen from './screens/SharedFilesScreen';
import NoteEditorScreen from './screens/NoteEditorScreen';
import MijnTakenScreen from './screens/MijnTakenScreen';
import LayoutTestScreen from './screens/LayoutTestScreen';
import ActiviteitScreen from './screens/ActiviteitScreen';
import SavedScreen from './screens/SavedScreen';
import ThreadsScreen from './screens/ThreadsScreen';
import MeerScreen from './screens/MeerScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

/**
 * Onderin een tabbalk, zoals in Slack. Voorheen liep alles via de
 * gesprekkenlijst: overzicht, activiteit en taken stonden als rijen bovenaan
 * die lijst of achter een icoon in de kopbalk, en waren daardoor lastig te
 * vinden. De schermen zelf zijn ongewijzigd — alleen de weg ernaartoe.
 */
function HoofdTabs({ user, onLogout }) {
  const iconen = {
    Chats: 'message-square',
    Threads: 'message-circle',
    Activiteit: 'activity',
    Taken: 'check-square',
    Meer: 'more-horizontal',
  };

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        // Elke tab houdt zijn eigen kopbalk, in dezelfde kleur als de rest.
        headerStyle: { backgroundColor: '#396971' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#4f46e5',
        tabBarIcon: ({ color, size }) => <Feather name={iconen[route.name]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen name="Chats" options={{ title: 'CTF Commi' }}>
        {(props) => <ConversationsScreen {...props} user={user} onLogout={onLogout} />}
      </Tabs.Screen>
      <Tabs.Screen name="Threads" component={ThreadsScreen} />
      <Tabs.Screen name="Activiteit" component={ActiviteitScreen} />
      <Tabs.Screen name="Taken" component={MijnTakenScreen} options={{ title: 'Mijn taken' }} />
      <Tabs.Screen name="Meer">
        {(props) => <MeerScreen {...props} user={user} onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  // Wijst de server ons token af, dan meteen terug naar het loginscherm.
  useEffect(() => { opSessieVerlopen(() => setUser(null)); }, []);
  const [loading, setLoading] = useState(true);
  const [navReady, setNavReady] = useState(false);
  const navRef = useRef(null);
  const pendingNavRef = useRef(null);
  const userRef = useRef(null);
  userRef.current = user;

  const loadUser = async () => {
    const t = await getToken();
    if (!t) { setUser(null); setLoading(false); return; }
    try { const me = await chat.me(); setUser(me); registerForPush(); }
    catch { setUser(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUser(); }, []);

  // Vang het OAuth-token op uit de deeplink (commi://auth?token=...), ook als de
  // in-app browser op Android sluit met 'dismiss' i.p.v. het resultaat terug te geven.
  useEffect(() => {
    const handleUrl = async (url) => {
      if (!url) return;
      const { queryParams } = Linking.parse(url);
      const pick = (v) => (Array.isArray(v) ? v[0] : v);
      const token = pick(queryParams?.token);
      if (token) { await setToken(token); loadUser(); }
    };
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    Linking.getInitialURL().then(handleUrl).catch(() => {});
    return () => sub.remove();
  }, []);

  // Tik op een notificatie → open het juiste gesprek. Robuust: navigeer pas als
  // de navigator klaar is én de gebruiker is ingelogd; bewaar anders als pending.
  const navReadyRef = useRef(false);
  navReadyRef.current = navReady;
  const openFromNotification = (data) => {
    try {
      const cid = data && data.conversation_id;
      if (!cid) return;
      const params = { id: Number(cid), title: data.title || 'Gesprek' };
      if (navRef.current && navReadyRef.current && userRef.current) {
        navRef.current.navigate('Chat', params);
      } else {
        pendingNavRef.current = params; // later afhandelen (zie onReady/login-effect)
      }
    } catch (e) { /* nooit de app laten crashen op een notificatie-tik */ }
  };

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      openFromNotification(resp?.notification?.request?.content?.data || {});
    });
    // App geopend vanuit gesloten staat door op een notificatie te tikken:
    Notifications.getLastNotificationResponseAsync()
      .then((resp) => { if (resp) openFromNotification(resp.notification.request.content.data || {}); })
      .catch(() => {});
    return () => sub.remove();
  }, []);

  // Pending navigatie afhandelen zodra navigator klaar is én user ingelogd.
  useEffect(() => {
    if (navReady && user && pendingNavRef.current && navRef.current) {
      const p = pendingNavRef.current;
      pendingNavRef.current = null;
      try { navRef.current.navigate('Chat', p); } catch (e) {}
    }
  }, [navReady, user]);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#396971" /></View>;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
    {/* Leest de echte toetsenbord-inset uit Android/iOS zelf; nodig sinds
        edge-to-edge (targetSdk 36), waar de standaard KeyboardAvoidingView
        er per toestel naast zit. */}
    <KeyboardProvider>
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#396971' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" options={{ headerShown: false }}>
              {(props) => <LoginScreen {...props} onLoggedIn={loadUser} />}
            </Stack.Screen>
            {/* Verborgen: lang drukken op het logo. Zelfde opbouw als een
                chatscherm (header + lijst + composer) om het toetsenbord-gedrag
                te kunnen testen zonder in te loggen. */}
            <Stack.Screen name="LayoutTest" component={LayoutTestScreen} options={{ title: 'Layout-test' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Conversations" options={{ headerShown: false }}>
              {(props) => <HoofdTabs {...props} user={user} onLogout={() => setUser(null)} />}
            </Stack.Screen>
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params?.title || 'Gesprek' })} />
            <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: 'Thread' }} />
            <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Overzicht' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ title: 'Zoeken' }} />
            <Stack.Screen name="NewChannel" component={NewChannelScreen} options={{ title: 'Nieuw kanaal' }} />
            <Stack.Screen name="NewDm" component={NewDmScreen} options={{ title: 'Nieuw gesprek' }} />
            <Stack.Screen name="Nieuw" options={{ title: 'Nieuw' }}>
              {(props) => <NieuwScreen {...props} user={user} />}
            </Stack.Screen>
            <Stack.Screen name="SharedFiles" component={SharedFilesScreen} options={{ title: 'Gedeelde bestanden' }} />
            <Stack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ title: 'Notitie' }} />
            <Stack.Screen name="MijnTaken" component={MijnTakenScreen} options={{ title: 'Mijn taken' }} />
            <Stack.Screen name="Activiteit" component={ActiviteitScreen} options={{ title: 'Activiteit' }} />
            <Stack.Screen name="Saved" component={SavedScreen} options={{ title: 'Bewaren voor later' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </KeyboardProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
