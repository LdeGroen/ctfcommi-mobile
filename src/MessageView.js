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
});

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Eén bericht. Lang indrukken → emoji-reactie kiezen. Geef onOpenThread mee om
// de thread-knop te tonen, en onReact om reageren mogelijk te maken.
// Gememoizeerd (zie export onderaan) zodat alleen gewijzigde berichten opnieuw
// renderen — scheelt veel werk bij lange gesprekken.
function MessageView({ item, c, onOpenThread, onReact, me, onEdit, onDelete }) {
  const [picker, setPicker] = useState(false);

  if (item.deleted_at) {
    return <Text style={[s.deleted, { color: c.muted }]}>bericht verwijderd</Text>;
  }

  const mine = me && item.user_id === me.id;
  const react = (emoji) => { setPicker(false); onReact && onReact(item, emoji); };
  const hasSheet = !!onReact || (mine && (onEdit || onDelete));

  return (
    <Pressable onLongPress={() => hasSheet && setPicker(true)} delayLongPress={250} style={s.msg}>
      <Avatar name={item.user?.name} uri={item.user?.avatar} size={36} />
      <View style={s.content}>
      <Text style={[s.author, { color: c.text }]}>
        {item.user?.name || 'Onbekend'} <Text style={[s.time, { color: c.muted }]}>{fmt(item.created_at)}{item.edited_at ? ' (bewerkt)' : ''}</Text>
      </Text>

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
            {mine && (onEdit || onDelete) && (
              <View style={[s.actions, { borderColor: c.border }]}>
                {onEdit && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => { setPicker(false); onEdit(item); }}>
                    <Feather name="edit-2" size={16} color={c.text} />
                    <Text style={[s.actionText, { color: c.text }]}>Bewerken</Text>
                  </TouchableOpacity>
                )}
                {onDelete && (
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
  driveCard: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 4 },
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
