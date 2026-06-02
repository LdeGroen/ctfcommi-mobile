import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { chat, getToken } from './src/api';
import { registerForPush } from './src/push';
import LoginScreen from './screens/LoginScreen';
import ConversationsScreen from './screens/ConversationsScreen';
import ChatScreen from './screens/ChatScreen';
import ThreadScreen from './screens/ThreadScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navRef = useRef(null);

  const loadUser = async () => {
    const t = await getToken();
    if (!t) { setUser(null); setLoading(false); return; }
    try { const me = await chat.me(); setUser(me); registerForPush(); }
    catch { setUser(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadUser(); }, []);

  // Tik op een notificatie → open het juiste gesprek.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data || {};
      if (data.conversation_id && navRef.current) {
        navRef.current.navigate('Chat', { id: Number(data.conversation_id) });
      }
    });
    return () => sub.remove();
  }, []);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#396971" /></View>;
  }

  return (
    <NavigationContainer ref={navRef}>
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
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
