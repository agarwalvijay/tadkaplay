import desi from './desi.js';
import universal from './universal.js';
import popculture from './popculture.js';

export const PACKS = [desi, universal, popculture];

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
    spectrums: PACKS.flatMap((p) => p.spectrums),
  };
}

export function getPack(id) {
  if (id === 'mix') return mixedPack();
  return PACKS.find((p) => p.id === id) || null;
}

// Deal `count` spectrums (no repeats; pads by reshuffling if the pack is small).
export function dealSpectrums(pack, count) {
  let out = shuffle(pack.spectrums);
  while (out.length < count) out = out.concat(shuffle(pack.spectrums));
  return out.slice(0, count);
}
