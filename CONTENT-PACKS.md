# Content packs

Every game's content lives in **theme packs** that are decoupled from the game
engine. The engine never hardcodes a question/word — it asks the pack registry.
That means **a new theme = one data file + one import line**, and "Western vs
Indian" is just *which pack you load*, not a separate game.

Each game has a `packs/` folder with one file per theme and an `index.js`
registry exposing `listPacks()` / `getPack(id)` plus a deal helper.

Shared pack metadata (drives the host's "pick a pack" screen):
`{ id, name, emoji, accent, spice, description }` — note `spice` reuses the
hub's 🌶️ meter as a difficulty hint.

## Per-game content shape
- **Crorepati** — `questions: [{ tier, q, options[4], answer }]`
  (`buildLadder()` orders questions easy→hard = the money ladder)
- **Doodle** — `words: [{ word, tier }]`
  (`dealWords()` hands the drawer a secret word)
- **Bluff** — `prompts: [{ q, a }]`
  (real answer `a` is mixed with players' fakes for the vote)

## Flow (all games)
1. Host opens the game → sees pack cards from `listPacks()` (Bollywood 🎬,
   Cricket 🏏, Hollywood 🤠, … plus **Tadka Mix 🌶️**).
2. Host picks a pack → engine pulls content via `getPack(id)` + the deal helper.
3. Same engine, totally different vibe.

## Add a theme (example: Crorepati “90s Music” pack)
1. `crorepati/packs/music90s.js` — export `{ id, name, emoji, accent, spice,
   description, questions: [...] }`.
2. Import it in `crorepati/packs/index.js` and add to `PACKS`.
3. Done — it appears on the host's pack screen automatically.
