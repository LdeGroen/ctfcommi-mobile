import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra || {};
export const API_URL = extra.apiUrl || 'https://backend.cafetheaterfestival.nl';
export const PUSHER_KEY = extra.pusherKey || '';
export const PUSHER_CLUSTER = extra.pusherCluster || 'eu';

const TOKEN_KEY = 'commi_auth_token';
let cachedToken = null;

export async function getToken() {
  if (cachedToken) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}
export async function setToken(t) { cachedToken = t; await SecureStore.setItemAsync(TOKEN_KEY, t); }
export async function clearToken() { cachedToken = null; await SecureStore.deleteItemAsync(TOKEN_KEY); }

export async function apiFetch(path, options = {}) {
  const token = await getToken();
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const e = new Error(body?.message || `HTTP ${res.status}`);
    e.status = res.status; e.body = body; throw e;
  }
  return body;
}

export const chat = {
  me: () => apiFetch('/api/chat/me'),
  listConversations: () => apiFetch('/api/chat/conversations'),
  getConversation: (id) => apiFetch(`/api/chat/conversations/${id}`),
  listMessages: (id, { before, limit = 30 } = {}) => {
    const qs = new URLSearchParams();
    if (before) qs.set('before', before);
    if (limit) qs.set('limit', limit);
    return apiFetch(`/api/chat/conversations/${id}/messages?${qs.toString()}`);
  },
  sendMessage: (id, { body, mentionUserIds = [], parentId = null, isAnnouncement = false }) =>
    apiFetch(`/api/chat/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body, mention_user_ids: mentionUserIds, parent_id: parentId, is_announcement: isAnnouncement }),
    }),
  editMessage: (messageId, body, mentionUserIds = []) =>
    apiFetch(`/api/chat/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ body, mention_user_ids: mentionUserIds }) }),
  deleteMessage: (messageId) => apiFetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' }),
  listReplies: (messageId) => apiFetch(`/api/chat/messages/${messageId}/replies`),
  // Gedeelde notities = berichten van soort 'note' in de stroom.
  placeNote: (id, { title = '', body = '', noteType = 'note' } = {}) => apiFetch(`/api/chat/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ kind: 'note', title, body, note_type: noteType }) }),
  updateNote: (messageId, { title = '', body = '', noteType } = {}) => apiFetch(`/api/chat/messages/${messageId}`, { method: 'PUT', body: JSON.stringify({ title, body, ...(noteType ? { note_type: noteType } : {}) }) }),
  togglePinNote: (messageId) => apiFetch(`/api/chat/messages/${messageId}/pin`, { method: 'POST' }),
  // To-do-items binnen een notitie (parentId = subitem onder dat item).
  addTodo: (noteId, text, parentId = null) => apiFetch(`/api/chat/messages/${noteId}/todos`, { method: 'POST', body: JSON.stringify({ text, parent_id: parentId }) }),
  updateTodo: (noteId, itemId, text) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}`, { method: 'PUT', body: JSON.stringify({ text }) }),
  toggleTodo: (noteId, itemId) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}/toggle`, { method: 'POST' }),
  moveTodo: (noteId, itemId, direction) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}/move`, { method: 'POST', body: JSON.stringify({ direction }) }),
  assignTodo: (noteId, itemId, userIds) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}/assignees`, { method: 'PUT', body: JSON.stringify({ user_ids: userIds }) }),
  setTodoDue: (noteId, itemId, dueOn) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}/due`, { method: 'PUT', body: JSON.stringify({ due_on: dueOn }) }),
  setTodoRecurrence: (noteId, itemId, recurrence) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}/recurrence`, { method: 'PUT', body: JSON.stringify({ recurrence }) }),
  deleteTodo: (noteId, itemId) => apiFetch(`/api/chat/messages/${noteId}/todos/${itemId}`, { method: 'DELETE' }),
  // Mijn taken: alle aan mij toegewezen open to-do's over alle gesprekken.
  myTodos: () => apiFetch('/api/chat/todos/mine'),
  // Leesbevestiging van een aankondiging: wie heeft 'm wel/niet gezien.
  messageReads: (messageId) => apiFetch(`/api/chat/messages/${messageId}/reads`),
  // Herinner-me op een bericht/gesprek.
  listReminders: () => apiFetch('/api/chat/reminders'),
  addReminder: ({ messageId = null, conversationId = null, note = null, remindAt }) =>
    apiFetch('/api/chat/reminders', { method: 'POST', body: JSON.stringify({ message_id: messageId, conversation_id: conversationId, note, remind_at: remindAt }) }),
  deleteReminder: (id) => apiFetch(`/api/chat/reminders/${id}`, { method: 'DELETE' }),
  activity: ({ before, limit = 30 } = {}) => {
    const qs = new URLSearchParams();
    if (before) qs.set('before', before);
    if (limit) qs.set('limit', limit);
    return apiFetch(`/api/chat/activity?${qs.toString()}`);
  },
  search: ({ q, conversationId, before, limit = 30 } = {}) => {
    const qs = new URLSearchParams();
    qs.set('q', q || '');
    if (conversationId) qs.set('conversation_id', conversationId);
    if (before) qs.set('before', before);
    if (limit) qs.set('limit', limit);
    return apiFetch(`/api/chat/search?${qs.toString()}`);
  },
  markRead: (id, lastReadMessageId) =>
    apiFetch(`/api/chat/conversations/${id}/read`, { method: 'POST', body: JSON.stringify({ last_read_message_id: lastReadMessageId }) }),
  hideConversation: (id) => apiFetch(`/api/chat/conversations/${id}/hide`, { method: 'POST' }),
  favoriteConversation: (id) => apiFetch(`/api/chat/conversations/${id}/favorite`, { method: 'POST' }),
  saveDraft: (id, body) => apiFetch(`/api/chat/conversations/${id}/draft`, { method: 'PUT', body: JSON.stringify({ body }) }),
  conversationAttachments: (id) => apiFetch(`/api/chat/conversations/${id}/attachments`),
  unfurl: (url) => apiFetch(`/api/chat/unfurl?url=${encodeURIComponent(url)}`),
  listUsers: (search = '') => apiFetch(`/api/chat/users${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createChannel: (data) => apiFetch('/api/chat/conversations', { method: 'POST', body: JSON.stringify(data) }),
  startDm: (userIds) => apiFetch('/api/chat/dm', { method: 'POST', body: JSON.stringify({ user_ids: userIds }) }),
  toggleReaction: (messageId, emoji) =>
    apiFetch(`/api/chat/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) }),
  registerDeviceToken: (token, platform) =>
    apiFetch('/api/chat/device-tokens', { method: 'POST', body: JSON.stringify({ token, platform }) }),
};
