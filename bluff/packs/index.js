import randomGyaan from './random-gyaan.js';
import wordNerd from './word-nerd.js';
import scienceIsh from './science-ish.js';
import desiMasala from './desi-masala.js';

export const PACKS = [randomGyaan, wordNerd, scienceIsh, desiMasala];

export function listPacks() {
  const list = PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
  list.push({ id: 'mix', name: 'Tadka Mix', emoji: '🎲', accent: '#ffd23f', spice: 3, description: 'A blend of every Bluff pack.' });
  return list;
}

export function getPack(id) {
  if (id === 'mix') return mixedPack();
  return PACKS.find((p) => p.id === id) || null;
}

// "Tadka Mix" — prompts from every pack.
export function mixedPack() {
  return {
    id: 'mix', name: 'Tadka Mix', emoji: '🎲', accent: '#ffd23f', spice: 3,
    description: 'A blend of every Bluff pack.',
    prompts: PACKS.flatMap((p) => p.prompts),
  };
}
