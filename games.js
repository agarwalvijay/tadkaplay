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

  // -------- on the workbench --------
  {
    id: 'soon-trivia',
    title: 'Coming Soon',
    tagline: 'Trivia, but make it chaos.',
    icon: '🎲',
    accent: '#ffcf3f',
    accent2: '#ff7a18',
    status: 'soon',
  },
  {
    id: 'soon-doodle',
    title: 'Coming Soon',
    tagline: 'Draw it. Guess it. Lose it.',
    icon: '🎨',
    accent: '#ff7a18',
    accent2: '#e63946',
    status: 'soon',
  },
  {
    id: 'soon-aim',
    title: 'Coming Soon',
    tagline: 'Aim high. Score higher.',
    icon: '🎯',
    accent: '#2dd4a7',
    accent2: '#ffb000',
    status: 'soon',
  },
];
