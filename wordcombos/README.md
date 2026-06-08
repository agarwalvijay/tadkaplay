# 🔤 Word Combos

A real-time multiplayer word-combo party game — think Boggle meets a Netflix party game.
Put the **host screen** on a TV or laptop, players **scan a QR code** with their phones,
pick a fun avatar, and race to trace as many words as they can in a shared letter grid.
Biggest score wins the podium. 🏆

## Features

- 📺 **Host big-screen** with QR-code join, animated lobby, live leaderboard, and a
  confetti-filled podium results screen.
- 📱 **Phone controller** — swipe across touching letters to build words, with a glowing
  trail, haptic buzz, and a procedural sound for every action.
- 🎭 **Avatars** — pick an emoji + color combo (or roll the dice for a random identity).
- 🔥 **Combo multipliers** for rapid-fire finds, arcade-style scoring, and end-of-round
  awards (Top Word, Longest Word, plus the grid's best hidden word).
- 🔊 **All sounds are synthesized** with the Web Audio API and the background art is pure
  CSS — there are **no media asset files** to ship.
- 📖 Words validated against a ~275k-word English dictionary; every grid is fully solved
  so the screen can show how many words were possible.

## Run it

```bash
npm install
npm start
```

Then open the **host screen** at the URL printed in the terminal
(e.g. `http://192.168.1.79:3000/host`) on the shared display, and have everyone on the
**same Wi-Fi** scan the QR code (or visit `/play` and type the 4-letter room code).

### Options

- `PORT` — server port (default `3000`).
- `ROUND_SECONDS` — length of each round (default `90`).

```bash
ROUND_SECONDS=120 PORT=4000 npm start
```

## How to play

1. Host clicks **Start a Game** → a room code + QR code appear.
2. Players join, choose an avatar, and tap **I'm Ready** (the round auto-starts when
   everyone's ready, or the host can hit **Start Round**).
3. A 4×4 grid appears on every phone. **Swipe across adjacent letters** (including
   diagonals) to spell words of 3+ letters. Find the same word once per round.
4. When the timer hits zero, the big screen reveals the podium, awards, and the grid's
   best possible word. Hit **Play Again** to go for another round with the same crew.

## Project layout

| File | Role |
| --- | --- |
| `server.js` | Express + Socket.IO server, room state machine, scoring |
| `game.js` | Grid generation (classic Boggle dice), path validation, scoring |
| `words.js` | Dictionary + binary-search prefix pruning + grid solver |
| `public/host.*` | Big-screen host UI |
| `public/player.*` | Phone controller UI |
| `public/sounds.js` | Procedural Web Audio sound engine |
| `public/fx.js` | Confetti, floating text, drifting background letters |
| `public/avatars.js` | Emoji/color avatar building blocks |
