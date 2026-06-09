// Naam Place Animal Cheez — a pack is a SET OF CATEGORIES to fill for the
// round's letter. Unique answers score more than ones others also wrote.
export const PACKS = [
  { id: 'classic', name: 'Classic', emoji: '📝', accent: '#4cc9f0', spice: 1,
    description: 'The original four.',
    categories: ['Naam (Name)', 'Place', 'Animal', 'Cheez (Thing)'] },
  { id: 'desi', name: 'Full Desi', emoji: '🌶️', accent: '#ff7a18', spice: 2,
    description: 'Bollywood, food & festivals.',
    categories: ['Bollywood', 'Indian City', 'Food', 'Festival'] },
  { id: 'mixed', name: 'Mixed Bag', emoji: '🎒', accent: '#9b5de5', spice: 2,
    description: 'Five varied categories.',
    categories: ['Name', 'Animal', 'Country', 'Brand', 'Movie'] },
];

// friendly letters only (no Q / X / Z)
export const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY';

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || PACKS[0];
}
