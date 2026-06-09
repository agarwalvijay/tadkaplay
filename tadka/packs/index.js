// Tadka Tashan "packs" are heat levels — they tune tempo, the timing window,
// and how fast the pan burns. (Difficulty as a pack, like every other game.)
export const SPICES = ['🌶️', '🧄', '🧅', '🌰', '🟡', '🍃', '🫑', '🧂'];

export const PACKS = [
  { id: 'mild', name: 'Mild', emoji: '🌱', accent: '#06d6a0', spice: 1,
    description: 'Gentle tempo, forgiving pan.',
    cues: 18, startInterval: 2400, endInterval: 1300, windowMs: 980, burnMiss: 12, burnCool: 10 },
  { id: 'medium', name: 'Medium', emoji: '🌶️', accent: '#ff7a18', spice: 2,
    description: 'A proper sizzle.',
    cues: 24, startInterval: 2000, endInterval: 1000, windowMs: 820, burnMiss: 16, burnCool: 8 },
  { id: 'spicy', name: 'Extra Spicy', emoji: '🔥', accent: '#e63946', spice: 3,
    description: 'Fast and unforgiving — for the brave.',
    cues: 30, startInterval: 1700, endInterval: 760, windowMs: 680, burnMiss: 21, burnCool: 7 },
];

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || PACKS[1];
}
