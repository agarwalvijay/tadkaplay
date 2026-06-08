// Avatar building blocks shared by the player picker and the displays.
export const EMOJIS = [
  '🦊', '🐼', '🐧', '🦁', '🐸', '🐙', '🦄', '🐯',
  '🐨', '🦖', '🐳', '🦉', '🐝', '🦋', '🐲', '🦕',
  '🦩', '🐢', '👽', '🤖', '👾', '🎃', '🦸', '🥷',
  '🧙', '🧛', '🦹', '🧚', '🐉', '🍄', '🌟', '🔥',
];

export const COLORS = [
  '#ff5d8f', '#ff8c42', '#ffd23f', '#06d6a0',
  '#3bceac', '#4cc9f0', '#5e60ce', '#9b5de5',
  '#f15bb5', '#00bbf9', '#fee440', '#ff006e',
];

export const ADJECTIVES = ['Turbo', 'Mega', 'Cosmic', 'Witty', 'Zippy', 'Lucky', 'Spark', 'Neon', 'Funky', 'Pixel', 'Wild', 'Hyper'];
export const NOUNS = ['Lexicon', 'Vowel', 'Speller', 'Wordy', 'Letterz', 'Scribe', 'Quill', 'Syllable', 'Riddle', 'Glyph', 'Cipher', 'Verb'];

export function randomName() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${a}${n}`;
}

export function randomAvatar() {
  return {
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  };
}
