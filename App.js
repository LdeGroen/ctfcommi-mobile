import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';
import { chat, getToken, setToken } from './src/api';
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

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
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
    <NavigationContainer ref={navRef} onReady={() => setNavReady(true)}>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#396971' }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }}>
        {!user ? (
          <Stack.Screen name="Login" options={{ headerShown: false }}>
            {(props) => <LoginScreen {...props} onLoggedIn={loadUser} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Conversations" options={{ title: 'CTF Commi' }}>
              {(props) => <ConversationsScreen {...props} user={user} onLogout={() => setUser(null)} />}
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
    </GestureHandlerRootView>
  );
}
