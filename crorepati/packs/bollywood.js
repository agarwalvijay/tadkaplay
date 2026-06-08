// A Crorepati content pack. The engine is theme-agnostic — it just reads this.
// `tier` 1..5 = difficulty, which maps to rungs on the money ladder.
// `answer` is the index (0-3) of the correct option.
export default {
  id: 'bollywood',
  name: 'Bollywood',
  emoji: '🎬',
  accent: '#ff3b30',
  spice: 1,
  description: 'Hindi cinema — classics to blockbusters.',
  questions: [
    { tier: 1, q: "Who is affectionately called the “King of Bollywood”?",
      options: ['Shah Rukh Khan', 'Amitabh Bachchan', 'Salman Khan', 'Aamir Khan'], answer: 0 },
    { tier: 1, q: "In which 1995 classic do Raj and Simran fall in love on a Europe trip?",
      options: ['Dilwale Dulhania Le Jayenge', 'Kuch Kuch Hota Hai', 'Kabhi Khushi Kabhie Gham', 'Maine Pyar Kiya'], answer: 0 },
    { tier: 2, q: "Which film gave us the mantra “All is well”?",
      options: ['3 Idiots', 'PK', 'Munna Bhai M.B.B.S.', 'Dangal'], answer: 0 },
    { tier: 2, q: "Who played the title role in “Munna Bhai M.B.B.S.”?",
      options: ['Sanjay Dutt', 'Arshad Warsi', 'Boman Irani', 'Sunil Dutt'], answer: 0 },
    { tier: 3, q: "For which 2001 film was India nominated for the Best Foreign Language Film Oscar?",
      options: ['Lagaan', 'Devdas', 'Swades', 'Taare Zameen Par'], answer: 0 },
    { tier: 4, q: "Which composer made his Hindi-film breakthrough with the soundtrack of “Roja”?",
      options: ['A. R. Rahman', 'Pritam', 'Shankar–Ehsaan–Loy', 'Vishal–Shekhar'], answer: 0 },
    { tier: 5, q: "Widely regarded as India's first full-length feature film (1913)?",
      options: ['Raja Harishchandra', 'Alam Ara', 'Mughal-e-Azam', 'Awaara'], answer: 0 },
  ],
};
