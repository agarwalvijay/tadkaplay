// Bhediya word packs. Everyone sees the CATEGORY (the pack name); only the
// townsfolk get the secret WORD — the lone wolf has to bluff a clue.
export const PACKS = [
  { id: 'food', name: 'Desi Food', emoji: '🍛', accent: '#ff7a18', spice: 1,
    description: 'Dishes & street food.',
    words: ['Samosa', 'Biryani', 'Dosa', 'Paneer Tikka', 'Jalebi', 'Pav Bhaji', 'Golgappa', 'Vada Pav', 'Butter Chicken', 'Masala Chai', 'Idli', 'Rajma Chawal', 'Gulab Jamun', 'Chole Bhature'] },
  { id: 'bollywood', name: 'Bollywood', emoji: '🎬', accent: '#ff006e', spice: 2,
    description: 'Films, stars & filmy things.',
    words: ['Shah Rukh Khan', 'Sholay', 'DDLJ', 'Item Number', 'Amitabh Bachchan', 'KGF', 'Baahubali', 'Filmfare', 'Dharmendra', 'Lagaan', '3 Idiots', 'Deewar', 'Mughal-e-Azam', 'Item Song'] },
  { id: 'animals', name: 'Animals', emoji: '🐾', accent: '#06d6a0', spice: 1,
    description: 'Creatures big and small.',
    words: ['Tiger', 'Elephant', 'Peacock', 'Cobra', 'Monkey', 'Camel', 'Parrot', 'Buffalo', 'Mongoose', 'Crocodile', 'Sparrow', 'Donkey', 'Goat', 'Lizard'] },
  { id: 'places', name: 'Places', emoji: '🗺️', accent: '#4cc9f0', spice: 1,
    description: 'Spots across India.',
    words: ['Taj Mahal', 'Goa', 'Himalayas', 'Mumbai Local', 'Chandni Chowk', 'Kerala', 'Jaipur', 'Varanasi', 'Marine Drive', 'Red Fort', 'Rishikesh', 'Darjeeling', 'India Gate', 'Hawa Mahal'] },
  { id: 'cricket', name: 'Cricket', emoji: '🏏', accent: '#ffd23f', spice: 2,
    description: 'The unofficial religion.',
    words: ['Sachin Tendulkar', 'Sixer', 'IPL', 'Yorker', 'Virat Kohli', 'Wankhede', 'Googly', 'Dhoni', 'Run Out', 'Maiden Over', 'Stadium', 'No Ball', 'Cover Drive', 'Stumps'] },
  { id: 'house', name: 'Around the House', emoji: '🏠', accent: '#9b5de5', spice: 1,
    description: 'Every Indian home has these.',
    words: ['Pressure Cooker', 'Charpai', 'Almirah', 'Geyser', 'Tulsi Plant', 'Ceiling Fan', 'Steel Tiffin', 'Mosquito Coil', 'Rangoli', 'Water Filter', 'Bucket Bath', 'Diya', 'Mortar Pestle', 'Sofa Cover'] },
];

export function listPacks() {
  return PACKS.map(({ id, name, emoji, accent, spice, description }) =>
    ({ id, name, emoji, accent, spice, description }));
}

export function getPack(id) {
  return PACKS.find((p) => p.id === id) || PACKS[0];
}
