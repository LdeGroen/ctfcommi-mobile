import Echo from 'laravel-echo';
import Pusher from 'pusher-js/react-native';
import { API_URL, PUSHER_KEY, PUSHER_CLUSTER, getToken } from './api';

let echo = null;

export async function getEcho() {
  if (echo) return echo;
  if (!PUSHER_KEY) return null;
  const token = await getToken();
  global.Pusher = Pusher;
  echo = new Echo({
    broadcaster: 'pusher',
    client: new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      forceTLS: true,
      authEndpoint: `${API_URL}/api/broadcasting/auth`,
      auth: { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    }),
  });
  return echo;
}

export function disconnectEcho() {
  if (echo) { try { echo.disconnect(); } catch {} echo = null; }
}
