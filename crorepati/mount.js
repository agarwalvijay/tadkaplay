// ===========================================================================
//  CROREPATI — KBC-style quiz. Players climb a money ladder: each question is
//  worth more than the last. Everyone answers on their phones; correct answers
//  bank the rung's value (with a small speed bonus for the quickest). Tiered
//  questions come from the chosen pack.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks, buildLadder } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANSWER_SECONDS = Number(process.env.KBC_ANSWER || 20);
const REVEAL_SECONDS = Number(process.env.KBC_REVEAL || 6);
const VALUES = [1000, 5000, 20000, 50000, 100000, 250000, 500000, 1000000]; // ₹ ladder

const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountCrorepati(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/crorepati',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, cur: null, ladder: [], roundIndex: -1 }),
  });

  app.get('/crorepati/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };

  function nextQuestion(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.ladder.length) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    const item = g.ladder[g.roundIndex];
    const value = VALUES[Math.min(g.roundIndex, VALUES.length - 1)];
    g.cur = { ...item, value, answers: new Map(), phase: 'answer', startedAt: Date.now() };

    api.broadcast('kbc:question', {
      round: g.roundIndex + 1, total: g.ladder.length,
      q: item.q, options: item.options, value, seconds: ANSWER_SECONDS,
    });
    api.toHost('kbc:progress', { answered: 0, total: api.activePlayers().length });
    api.broadcastPlayers();
    clearTimer(room);
    room.game.timer = setTimeout(() => closeQuestion(room, api), ANSWER_SECONDS * 1000);
  }

  function closeQuestion(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'answer') return;
    clearTimer(room);
    cur.phase = 'reveal';

    // tally + scoring (value for correct; +25% speed bonus for the fastest correct)
    const tally = [0, 0, 0, 0];
    let fastest = null;
    const correctNames = [];
    for (const [key, a] of cur.answers) {
      tally[a.choice] = (tally[a.choice] || 0) + 1;
      if (a.choice === cur.answer) {
        addScore(room, key, cur.value);
        correctNames.push(nameOf(room, key));
        if (!fastest || a.time < fastest.time) fastest = { key, time: a.time };
      }
    }
    if (fastest) addScore(room, fastest.key, Math.round(cur.value * 0.25));

    api.broadcast('kbc:reveal', {
      answer: cur.answer, tally, value: cur.value,
      correct: correctNames,
      fastest: fastest ? nameOf(room, fastest.key) : null,
      scores: api.players(),
    });
    api.broadcastPlayers();
    room.game.timer = setTimeout(() => nextQuestion(room, api), REVEAL_SECONDS * 1000);
  }

  function finish(room, api) {
    clearTimer(room);
    room.state = 'results';
    api.broadcast('game:over', { results: api.players() });
  }

  gs.onStart((room, api) => {
    const pack = getPack(api.payload?.packId) || PACKS[0];
    room.game.ladder = buildLadder(pack, { perTier: 1, maxTier: 5 });
    room.game.roundIndex = -1;
    nextQuestion(room, api);
  });

  gs.onReset((room) => { clearTimer(room); room.game.cur = null; room.game.roundIndex = -1; });

  gs.handle('kbc:answer', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'answer' || !player || player.spectator) return ack?.({ ok: false });
    if (cur.answers.has(player.id)) return ack?.({ ok: true, already: true });
    const choice = Number(payload?.choice);
    if (!(choice >= 0 && choice <= 3)) return ack?.({ ok: false });
    cur.answers.set(player.id, { choice, time: Date.now() - cur.startedAt });
    ack?.({ ok: true });
    api.toHost('kbc:progress', { answered: cur.answers.size, total: api.activePlayers().length });
    if (cur.answers.size >= api.activePlayers().length) closeQuestion(room, api);
  });

  return gs;
}
