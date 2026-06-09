// Tadka Tashan "packs" are heat levels — they tune tempo, the timing window,
// and how fast the pan burns. (Difficulty as a pack, like every other game.)
export const SPICES = ['🌶️', '🧄', '🧅', '🌰', '🟡', '🍃', '🫑', '🧂'];

export const PACKS = [
  { id: 'mild', name: 'Mild', emoji: '🌱', accent: '#06d6a0', spice: 1,
    description: 'Quick but forgiving.',
    cues: 22, startInterval: 850, endInterval: 320, windowMs: 720, burnMiss: 12, burnCool: 10 },
  { id: 'medium', name: 'Medium', emoji: '🌶️', accent: '#ff7a18', spice: 2,
    description: 'A proper sizzle.',
    cues: 28, startInterval: 620, endInterval: 220, windowMs: 560, burnMiss: 16, burnCool: 8 },
  { id: 'spicy', name: 'Extra Spicy', emoji: '🔥', accent: '#e63946', spice: 3,
    description: 'Fast and frantic — for the brave.',
    cues: 36, startInterval: 430, endInterval: 110, windowMs: 440, burnMiss: 21, burnCool: 7 },
];

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || PACKS[1];
}
