import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet, Pressable, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import Avatar from './Avatar';
import LinkPreview from './LinkPreview';

const URL_RE = /\bhttps?:\/\/[^\s<>()]+[^\s<>().,!?'"]/gi;
function extractUrls(text) {
  if (!text) return [];
  return Array.from(new Set(text.match(URL_RE) || []));
}
function isPdf(a) {
  return a.mime === 'application/pdf' || /\.pdf(\?.*)?$/i.test(a.filename || a.url || '');
}

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

// Gedeeld kleurschema (licht/donker) — gebruikt door Chat- en ThreadScreen.
export const theme = (dark) => ({
  bg: dark ? '#0b1220' : '#fff',
  text: dark ? '#f3f4f6' : '#111827',
  muted: dark ? '#9ca3af' : '#6b7280',
  border: dark ? '#1f2937' : '#e5e7eb',
  noteBg: dark ? 'rgba(120,53,15,0.18)' : '#fffbeb',
  noteBorder: dark ? 'rgba(146,64,14,0.5)' : '#fde68a',
});

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDue(iso) {
  if (!iso) return '';
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' });
}
function isOverdue(iso) {
  if (!iso) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return new Date(iso + 'T00:00:00') <= t;
}

// Eén bericht. Lang indrukken → emoji-reactie kiezen. Geef onOpenThread mee om
// de thread-knop te tonen, en onReact om reageren mogelijk te maken.
// Gememoizeerd (zie export onderaan) zodat alleen gewijzigde berichten opnieuw
// renderen — scheelt veel werk bij lange gesprekken.
function MessageView({ item, c, onOpenThread, onReact, me, onEdit, onDelete, onOpenNote, onToggleTodo, onRemind, onSave, onShowReads, onOpenProfile }) {
  const [picker, setPicker] = useState(false);

  if (item.deleted_at) {
    return <Text style={[s.deleted, { color: c.muted }]}>bericht verwijderd</Text>;
  }

  // Gedeelde notitie: kaart in de stroom, tik om te openen/bewerken.
  if (item.kind === 'note') {
    const isTodo = item.note_type === 'todo';
    const todos = item.todos || [];
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={() => onOpenNote && onOpenNote(item)}
                        style={[s.noteCard, { borderColor: c.noteBorder, backgroundColor: c.noteBg }]}>
        <View style={s.noteHead}>
          <Feather name={isTodo ? 'check-square' : 'file-text'} size={14} color="#f59e0b" />
          <Text style={[s.noteTitle, { color: c.text }]} numberOfLines={1}>{item.title || (isTodo ? 'To-do' : 'Notitie')}</Text>
          {item.pinned_at ? <Feather name="bookmark" size={13} color="#f59e0b" /> : null}
        </View>

        {isTodo ? (
          todos.length ? todos.filter((t) => !t.parent_id).sort((a, b) => a.position - b.position).flatMap((top) => [
            top,
            ...todos.filter((t) => t.parent_id === top.id).sort((a, b) => a.position - b.position),
          ]).map((t) => (
            <View key={t.id} style={[s.todoRow, t.parent_id && s.todoChild]}>
              <TouchableOpacity onPress={() => onToggleTodo && onToggleTodo(item, t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name={t.done ? 'check-square' : 'square'} size={17} color={t.done ? '#f59e0b' : c.muted} />
              </TouchableOpacity>
              <Text style={[s.todoText, { color: t.done ? c.muted : c.text }, t.done && s.todoDone]}>
                {t.text}
                {t.done && t.done_by_name ? <Text style={s.todoBy}>  ✓ {t.done_by_name}</Text> : null}
              </Text>
              {t.due_on ? (
                <Text style={[s.dueBadge, !t.done && isOverdue(t.due_on) ? s.dueOverdue : s.dueNormal]}>{fmtDue(t.due_on)}</Text>
              ) : null}
              {(t.assignees || []).length > 0 && (
                <View style={s.avatarRow}>
                  {t.assignees.slice(0, 3).map((a) => (
                    <View key={a.id} style={s.avatarWrap}><Avatar name={a.name} uri={a.avatar} size={20} /></View>
                  ))}
                </View>
              )}
            </View>
          )) : <Text style={{ color: c.muted, fontStyle: 'italic', fontSize: 13 }}>Nog geen items — tik om toe te voegen</Text>
        ) : (
          item.body?.trim()
            ? <Markdown style={{ body: { color: c.text, fontSize: 14 }, link: { color: '#6366f1' } }}>{item.body.length > 400 ? item.body.slice(0, 400) + '…' : item.body}</Markdown>
            : <Text style={{ color: c.muted, fontStyle: 'italic', fontSize: 13 }}>Leeg — tik om te schrijven</Text>
        )}

        <Text style={[s.noteMeta, { color: c.muted }]}>{item.edited_at ? 'bewerkt ' : ''}{fmt(item.edited_at || item.created_at)}{item.user?.name ? ` · ${item.user.name}` : ''}</Text>
      </TouchableOpacity>
    );
  }

  const mine = me && item.user_id === me.id;
  const react = (emoji) => { setPicker(false); onReact && onReact(item, emoji); };
  const hasSheet = !!onReact || !!onRemind || !!onSave || (mine && (onEdit || onDelete));

  return (
    <Pressable onLongPress={() => hasSheet && setPicker(true)} delayLongPress={250} style={s.msg}>
      {/* Avatar en naam openen het profiel: wie is dit, en hoe bereik ik ze. */}
      <Pressable onPress={() => onOpenProfile?.(item.user?.id)}>
        <Avatar name={item.user?.name} uri={item.user?.avatar} size={36} />
      </Pressable>
      <View style={s.content}>
      <Text style={[s.author, { color: c.text }]} onPress={() => onOpenProfile?.(item.user?.id)}>
        {item.user?.name || 'Onbekend'}
        {item.user?.status ? <Text style={[s.time, { color: c.muted }]}> {item.user.status}</Text> : null}
        <Text style={[s.time, { color: c.muted }]}> {fmt(item.created_at)}{item.edited_at ? ' (bewerkt)' : ''}</Text>
        {item.is_saved ? <Text> <Feather name="bookmark" size={12} color="#f59e0b" /></Text> : null}
      </Text>

      {item.is_announcement && (
        <View style={s.annBadge}>
          <Feather name="volume-2" size={12} color="#b45309" />
          <Text style={s.annText}>Aankondiging</Text>
        </View>
      )}

      {!!item.body && <Markdown style={{ body: { color: c.text, fontSize: 15 }, link: { color: '#6366f1' } }}>{item.body}</Markdown>}

      {item.attachments?.map((a) => (
        a.source === 'drive' ? (
          <TouchableOpacity key={a.id} onPress={() => a.url && Linking.openURL(a.url)}
                            style={[s.driveCard, { borderColor: c.border, backgroundColor: c.bg }]}>
            <Feather name="hard-drive" size={15} color="#6366f1" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 14 }}>{a.filename}</Text>
              <Text style={{ color: c.muted, fontSize: 11 }}>Google Drive</Text>
            </View>
          </TouchableOpacity>
        ) : isPdf(a) ? (
          <TouchableOpacity key={a.id} onPress={() => a.url && Linking.openURL(a.url)}
                            style={[s.driveCard, { borderColor: c.border, backgroundColor: c.bg }]}>
            <Feather name="file-text" size={15} color="#dc2626" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: c.text, fontSize: 14 }}>{a.filename}</Text>
              <Text style={{ color: c.muted, fontSize: 11 }}>PDF — tik om te openen</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <Text key={a.id} style={{ color: '#6366f1', marginTop: 2 }} onPress={() => Linking.openURL(a.url)}>
            <Feather name="paperclip" size={13} color="#6366f1" /> {a.filename}
          </Text>
        )
      ))}

      {!!item.body && extractUrls(item.body).slice(0, 2).map((u) => <LinkPreview key={u} url={u} c={c} />)}

      {item.reactions?.length > 0 && (
        <View style={s.reactionRow}>
          {item.reactions.map((r) => (
            <TouchableOpacity key={r.emoji} onPress={() => onReact && onReact(item, r.emoji)} style={[s.chip, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 13 }}>{r.emoji} {r.count}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {item.is_announcement && item.reads && (
        <TouchableOpacity onPress={() => onShowReads && onShowReads(item)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>
            <Feather name="check-circle" size={12} color={c.muted} /> Gezien door {item.reads.count}/{item.reads.total}
          </Text>
        </TouchableOpacity>
      )}

      {onOpenThread && (
        <TouchableOpacity onPress={() => onOpenThread(item)}>
          <Text style={{ color: '#6366f1', marginTop: 4, fontSize: 13 }}>
            <Feather name="message-square" size={13} color="#6366f1" />{' '}
            {item.reply_count > 0 ? `${item.reply_count} ${item.reply_count === 1 ? 'antwoord' : 'antwoorden'}` : 'Reageren in thread'}
          </Text>
        </TouchableOpacity>
      )}

      </View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={s.backdrop} onPress={() => setPicker(false)}>
          <View style={[s.sheet, { backgroundColor: c.bg, borderColor: c.border }]}>
            {!!onReact && (
              <View style={s.emojiRow}>
                {QUICK.map((e) => (
                  <TouchableOpacity key={e} onPress={() => react(e)} style={s.emojiBtn}>
                    <Text style={{ fontSize: 30 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {(onRemind || onSave || (mine && (onEdit || onDelete))) && (
              <View style={[s.actions, { borderColor: c.border }]}>
                {onRemind && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setPicker(false); onRemind(item); }}>
                    <Feather name="clock" size={16} color={c.text} />
                    <Text style={[s.actionText, { color: c.text }]}>Herinner me</Text>
                  </TouchableOpacity>
                )}
                {onSave && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setPicker(false); onSave(item); }}>
                    <Feather name="bookmark" size={16} color={item.is_saved ? '#f59e0b' : c.text} />
                    <Text style={[s.actionText, { color: item.is_saved ? '#f59e0b' : c.text }]}>
                      {item.is_saved ? 'Niet meer bewaren' : 'Bewaren voor later'}
                    </Text>
                  </TouchableOpacity>
                )}
                {mine && onEdit && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setPicker(false); onEdit(item); }}>
                    <Feather name="edit-2" size={16} color={c.text} />
                    <Text style={[s.actionText, { color: c.text }]}>Bewerken</Text>
                  </TouchableOpacity>
                )}
                {mine && onDelete && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setPicker(false); onDelete(item); }}>
                    <Feather name="trash-2" size={16} color="#dc2626" />
                    <Text style={[s.actionText, { color: '#dc2626' }]}>Verwijderen</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

const s = StyleSheet.create({
  msg: { marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  content: { flex: 1, minWidth: 0 },
  author: { fontSize: 14, fontWeight: '600' },
  time: { fontSize: 11, fontWeight: '400' },
  deleted: { fontStyle: 'italic', marginBottom: 12, fontSize: 13 },
  noteCard: { marginBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  noteTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
  noteMeta: { fontSize: 11, marginTop: 4 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  todoChild: { marginLeft: 22 },
  todoText: { flex: 1, fontSize: 14 },
  dueBadge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, overflow: 'hidden' },
  dueNormal: { backgroundColor: '#fef3c7', color: '#b45309' },
  dueOverdue: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  avatarRow: { flexDirection: 'row' },
  avatarWrap: { marginLeft: -6, borderRadius: 10, borderWidth: 1.5, borderColor: '#fffbeb' },
  todoDone: { textDecorationLine: 'line-through' },
  todoBy: { fontSize: 11, color: '#b45309', textDecorationLine: 'none' },
  driveCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
  annBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fef3c7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2, marginBottom: 2 },
  annText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  sheet: { padding: 16, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, maxWidth: 320 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  emojiBtn: { padding: 8 },
  actions: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8 },
  actionText: { fontSize: 15, fontWeight: '500' },
});

export default React.memo(MessageView);
