// A Bluff pack. The engine shows `q`; players each invent a fake answer; the
// real `a` is shuffled in with the fakes and everyone votes. Best prompts have
// answers nobody quite knows but sound plausible once written.
export default {
  id: 'random-gyaan',
  name: 'Random Gyaan',
  emoji: '🧠',
  accent: '#9b5de5',
  spice: 2,
  description: 'Obscure facts to bluff your friends with.',
  prompts: [
    { q: "What's the plastic or metal tip at the end of a shoelace called?", a: 'An aglet' },
    { q: "What's the name for the dot above a lowercase “i” or “j”?", a: 'A tittle' },
    { q: "A group of crows is collectively known as a ___?", a: 'A murder' },
    { q: "What's the groove between your nose and upper lip called?", a: 'The philtrum' },
    { q: "What's the word for the pleasant smell of rain on dry earth?", a: 'Petrichor' },
    { q: "What's the technical name for the “#” symbol?", a: 'An octothorpe' },
    { q: "What's the collective noun for a group of owls?", a: 'A parliament' },
    { q: "What do you call the day before yesterday, in one word?", a: 'Ereyesterday' },
  ],
};
