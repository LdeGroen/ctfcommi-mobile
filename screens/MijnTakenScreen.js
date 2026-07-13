import React, { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SectionList, RefreshControl, ActivityIndicator, useColorScheme,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { chat } from '../src/api';

const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  card: dark ? '#111827' : '#f9fafb',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
});

const todayISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); };
const weekISO = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); };
function fmtDue(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
}
function bucketOf(due) {
  if (!due) return 'geen';
  const t = todayISO();
  if (due < t) return 'verlopen';
  if (due === t) return 'vandaag';
  if (due <= weekISO()) return 'week';
  return 'later';
}
const BUCKETS = [
  ['verlopen', 'Verlopen'],
  ['vandaag', 'Vandaag'],
  ['week', 'Deze week'],
  ['later', 'Later'],
  ['geen', 'Zonder deadline'],
];

// Persoonlijk overzicht van alle aan mij toegewezen open to-do's, over álle
// gesprekken heen, gegroepeerd op deadline. Direct afvinken of naar het gesprek.
export default function MijnTakenScreen({ navigation }) {
  const dark = useColorScheme() === 'dark';
  const c = theme(dark);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await chat.myTodos();
      setTasks(res.tasks || []);
    } catch { /* stil */ } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const complete = async (t) => {
    setTasks((arr) => arr.filter((x) => x.id !== t.id)); // optimistisch weghalen
    try { await chat.toggleTodo(t.message_id, t.id); } catch { load(); }
  };

  const sections = BUCKETS
    .map(([key, title]) => ({ title, data: tasks.filter((t) => bucketOf(t.due_on) === key) }))
    .filter((s) => s.data.length > 0);

  if (loading) {
    return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator color="#6366f1" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {tasks.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-circle" size={40} color={c.muted} />
          <Text style={{ color: c.muted, marginTop: 12, fontSize: 15 }}>Geen openstaande taken. 🎉</Text>
          <Text style={{ color: c.muted, marginTop: 4, fontSize: 13, textAlign: 'center', paddingHorizontal: 40 }}>
            Taken die in een gesprek aan jou worden toegewezen, verschijnen hier.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />}
          contentContainerStyle={{ padding: 12 }}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.section, { color: c.muted }]}>{section.title} · {section.data.length}</Text>
          )}
          renderItem={({ item, section }) => {
            const overdue = section.title === 'Verlopen';
            return (
              <View style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}>
                <TouchableOpacity onPress={() => complete(item)} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
                  <Feather name="square" size={22} color={c.muted} />
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Chat', { id: item.conversation_id, title: item.conversation_name })}>
                  <Text style={{ color: c.text, fontSize: 15 }} numberOfLines={2}>{item.text}</Text>
                  <View style={styles.meta}>
                    <Feather name="hash" size={11} color={c.muted} />
                    <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{item.conversation_name}</Text>
                    {item.recurrence ? <Feather name="repeat" size={11} color={c.muted} /> : null}
                  </View>
                </TouchableOpacity>
                {item.due_on ? (
                  <Text style={[styles.due, overdue ? styles.dueOverdue : styles.dueNormal]}>{fmtDue(item.due_on)}</Text>
                ) : null}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  section: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  due: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  dueNormal: { backgroundColor: '#fef3c7', color: '#b45309' },
  dueOverdue: { backgroundColor: '#fee2e2', color: '#b91c1c' },
});
