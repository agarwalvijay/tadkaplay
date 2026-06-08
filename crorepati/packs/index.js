// Pack registry + helpers. This is the whole API the Crorepati engine needs —
// it never hardcodes a single question. Add a theme = drop in a file + 1 import.
import bollywood from './bollywood.js';
import cricket from './cricket.js';
import hollywood from './hollywood.js';

export const PACKS = [bollywood, cricket, hollywood];

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Lightweight list for the host's "pick a pack" screen (no questions leaked).
export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  if (id === 'mix') return mixedPack();
  return PACKS.find((p) => p.id === id) || null;
}

// Build an ascending-difficulty ladder: `perTier` random questions per tier.
// That ordering IS the money ladder — easy rungs first, hard rungs last.
export function buildLadder(pack, { perTier = 1, maxTier = 5 } = {}) {
  const ladder = [];
  for (let tier = 1; tier <= maxTier; tier++) {
    const pool = shuffle(pack.questions.filter((q) => q.tier === tier));
    ladder.push(...pool.slice(0, perTier));
  }
  return ladder;
}

// "Tadka Mix" — every pack blended together, still tiered.
export function mixedPack() {
  return {
    id: 'mix',
    name: 'Tadka Mix',
    emoji: '🌶️',
    accent: '#ff7a18',
    spice: 3,
    description: 'A spicy blend of every theme.',
    questions: PACKS.flatMap((p) => p.questions),
  };
}
