import desi from './desi.js';
import everyday from './everyday.js';
import office from './office.js';

export const PACKS = [desi, everyday, office];

const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function listPacks() {
  const list = PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
  list.push({ id: 'mix', name: 'Tadka Mix', emoji: '🎲', accent: '#ffd23f', spice: 3, description: 'A blend of every pack.' });
  return list;
}

export function mixedPack() {
  return {
    id: 'mix', name: 'Tadka Mix', emoji: '🎲', accent: '#ffd23f', spice: 3,
    description: 'A blend of every pack.',
    prompts: PACKS.flatMap((p) => p.prompts),
  };
}

export function getPack(id) {
  if (id === 'mix') return mixedPack();
  return PACKS.find((p) => p.id === id) || null;
}
