// Tekst-emoticons → emoji (mobiel). Zelfde set als de webclient.
const EMOTICONS = {
  ':)': '🙂', ':-)': '🙂', '=)': '🙂',
  ':(': '🙁', ':-(': '🙁',
  ':D': '😄', ':-D': '😄',
  ';)': '😉', ';-)': '😉',
  ':P': '😛', ':p': '😛', ':-P': '😛', ':-p': '😛',
  ':O': '😮', ':o': '😮', ':-O': '😮',
  ':|': '😐', ':-|': '😐',
  ":'(": '😢',
  ':*': '😘', ':-*': '😘',
  '8)': '😎', 'B)': '😎',
  '<3': '❤️', '</3': '💔',
};

// Zet emoticons in een string om naar emoji.
export function convertEmoticons(text) {
  let out = text;
  Object.entries(EMOTICONS).forEach(([k, v]) => {
    if (out.includes(k)) out = out.split(k).join(v);
  });
  return out;
}
