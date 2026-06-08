// ===========================================================================
//  GAME CATALOG  —  add a new game by dropping another object into GAMES.
//
//  Fields:
//    title, tagline, description, icon (emoji)
//    accent / accent2  -> the card's neon gradient
//    status: 'live' | 'soon'
//    For live games, point the card at the game's entry screen with either:
//      port  + entry   -> built as  <protocol>//<this-host>:<port><entry>
//                         (so it works on localhost AND your LAN IP)
//      url             -> an absolute link, used as-is (overrides port/entry)
//    meta: short chips shown on the card (players, round length, tags…)
// ===========================================================================

export const SITE = {
  hero: 'TADKA PLAY', // English letters, styled like Devanagari (shirorekha)
  kicker: 'थोड़ा तड़का, ढेर सारी मस्ती 🌶️', // the one Hindi line we keep
  subtitle: 'Homemade party games with a desi twist — host on the big screen, everyone plays on their phones.',
  domain: 'tadkaplay.com',
};

export const GAMES = [
  {
    id: 'wordcombos',
    title: 'Word Combos',
    tagline: 'Find the words. Beat your friends.',
    description:
      'A fast, frantic word-search party game. Swipe touching letters to build words before the timer runs out.',
    icon: '🔤',
    accent: '#ffb000',
    accent2: '#ff3b30',
    gfx: 'wordboard',
    status: 'live',
    path: '/wordcombos/host',
    spice: 2,
    meta: ['👥 2–12', '⏱ 90s rounds'],
  },

  {
    id: 'bluff',
    title: 'Bluff',
    tagline: 'Lie convincingly. Spot the truth.',
    description: 'Everyone writes a fake answer to an obscure question, then votes for the real one. Fool your friends, find the truth.',
    icon: '🤥',
    accent: '#9b5de5',
    accent2: '#ff006e',
    gfx: 'bluff',
    status: 'live',
    path: '/bluff/host',
    spice: 2,
    meta: ['👥 3–10', '🃏 Bluffing'],
  },

  {
    id: 'andaaza',
    title: 'Andaaza',
    tagline: 'Read the room. Find the wavelength.',
    description: 'One player sees a hidden target on a spectrum (Mild ↔ Spicy) and gives a one-word clue; everyone else drags a slider to guess where it is. Closer = more points.',
    icon: '🔮',
    accent: '#9b5de5',
    accent2: '#4cc9f0',
    gfx: 'spectrum',
    status: 'live',
    path: '/andaaza/host',
    spice: 2,
    meta: ['👥 3–10', '🎯 Guessing'],
  },
  {
    id: 'fill',
    title: 'Khaali Jagah',
    tagline: 'Fill in the blank. Win the room.',
    description: 'Everyone fills the blank in a prompt with something funny; then the whole room votes for the favourite. Most votes wins the points.',
    icon: '✍️',
    accent: '#ff006e',
    accent2: '#ff8c42',
    gfx: 'fill',
    status: 'live',
    path: '/fill/host',
    spice: 2,
    meta: ['👥 3–10', '😂 Party'],
  },
  {
    id: 'sur',
    title: 'Sur',
    tagline: 'Make music together.',
    description: 'Each phone becomes a desi instrument — tabla, sitar, bansuri, dholak — and the whole room jams live over a beat. Then vote for the best musician.',
    icon: '🎵',
    accent: '#ffb000',
    accent2: '#ff006e',
    gfx: 'sur',
    status: 'live',
    path: '/sur/host',
    spice: 1,
    meta: ['👥 2–10', '🎶 Music'],
  },
  {
    id: 'hil',
    title: 'Hil Mat!',
    tagline: "Tilt together. Don't drop it.",
    description: 'Everyone tilts their phone to steer ONE wobbly platform — keep the cargo (laddoos, chai, donuts…) from sliding off and deliver it. A co-op tilt challenge for the whole room.',
    icon: '📲',
    accent: '#ffb000',
    accent2: '#06d6a0',
    gfx: 'tilt',
    status: 'live',
    path: '/hil/host',
    spice: 2,
    meta: ['👥 2–10', '🤝 Co-op', '📲 Tilt'],
  },
  {
    id: 'doodle',
    title: 'Doodle',
    tagline: 'Draw it. Guess it.',
    description: 'One player draws a secret word on their phone; it streams to the big screen while everyone else races to guess it.',
    icon: '🎨',
    accent: '#ff7a18',
    accent2: '#e63946',
    gfx: 'doodle',
    status: 'live',
    path: '/doodle/host',
    spice: 1,
    meta: ['👥 3–8', '✏️ Drawing'],
  },
  {
    id: 'crorepati',
    title: 'Crorepati',
    tagline: 'Answer fast. Climb the ladder.',
    description: 'A KBC-style quiz — everyone answers on their phones and banks the rung’s prize money. Pick a category: Bollywood, Cricket or Hollywood.',
    icon: '💰',
    accent: '#ffd23f',
    accent2: '#ff8c42',
    gfx: 'crorepati',
    status: 'live',
    path: '/crorepati/host',
    spice: 2,
    meta: ['👥 2–12', '❓ Trivia'],
  },
];
