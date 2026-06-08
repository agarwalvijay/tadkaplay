// Doodle pack registry. Same shape as Crorepati's, but the unit of content
// is a word to draw instead of a question.
import desi from './desi.js';
import hollywood from './hollywood.js';

export const PACKS = [desi, hollywood];

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  if (id === 'mix') return mixedPack();
  return PACKS.find((p) => p.id === id) || null;
}

// Deal a queue of words to draw (optionally filtered by difficulty), no repeats.
export function dealWords(pack, { count = 8, maxTier = 3 } = {}) {
  const pool = shuffle(pack.words.filter((w) => w.tier <= maxTier));
  return pool.slice(0, count).map((w) => w.word);
}

export function mixedPack() {
  return {
    id: 'mix', name: 'Tadka Mix', emoji: '🌶️', accent: '#ff7a18', spice: 2,
    description: 'Words from every pack.',
    words: PACKS.flatMap((p) => p.words),
  };
}
