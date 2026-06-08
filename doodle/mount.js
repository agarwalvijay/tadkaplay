// ===========================================================================
//  DOODLE — Pictionary. Each round one player is the drawer: the engine shows
//  them a secret word from the chosen pack; their strokes stream to the host
//  screen and everyone's phones; the others race to type the right guess.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks, dealWords } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_ROUNDS = Number(process.env.DOODLE_ROUNDS || 8);
const DRAW_SECONDS = Number(process.env.DOODLE_DRAW || 75);
const REVEAL_SECONDS = Number(process.env.DOODLE_REVEAL || 6);

const norm = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountDoodle(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/doodle',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, cur: null, words: [], order: [], roundIndex: -1 }),
  });

  app.get('/doodle/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.order.length) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    const drawerKey = g.order[g.roundIndex];
    const word = g.words[g.roundIndex];
    const answer = word.replace(/\(.*?\)/g, '').trim();
    g.cur = { drawerKey, word, answerNorm: norm(answer), guessed: new Map(), phase: 'draw' };

    const pattern = answer.split(/\s+/).map((w) => '_'.repeat(w.length)).join('   ');
    api.broadcast('doodle:clear');
    api.broadcast('doodle:round', {
      round: g.roundIndex + 1, total: g.order.length,
      drawerId: drawerKey, drawerName: nameOf(room, drawerKey),
      pattern, seconds: DRAW_SECONDS,
    });
    const drawerSocket = room.players.get(drawerKey)?.socketId;
    if (drawerSocket) api.toSocket(drawerSocket, 'doodle:word', { word, answer });
    api.broadcastPlayers();
    clearTimer(room);
    room.game.timer = setTimeout(() => revealRound(room, api), DRAW_SECONDS * 1000);
  }

  function revealRound(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase === 'reveal') return;
    clearTimer(room);
    cur.phase = 'reveal';
    const guessers = [...cur.guessed.keys()].map((k) => nameOf(room, k));
    api.broadcast('doodle:reveal', {
      word: cur.word, drawer: nameOf(room, cur.drawerKey), guessers, scores: api.players(),
    });
    api.broadcastPlayers();
    room.game.timer = setTimeout(() => nextRound(room, api), REVEAL_SECONDS * 1000);
  }

  function finish(room, api) {
    clearTimer(room);
    room.state = 'results';
    api.broadcast('game:over', { results: api.players() });
  }

  gs.onStart((room, api) => {
    const pack = getPack(api.payload?.packId) || PACKS[0];
    const active = api.activePlayers().map((p) => p.id);
    const order = api.shuffle(active).slice(0, Math.min(active.length, MAX_ROUNDS));
    let words = dealWords(pack, { count: order.length, maxTier: 3 });
    while (words.length < order.length) words = words.concat(dealWords(pack, { count: order.length, maxTier: 3 }));
    room.game.order = order;
    room.game.words = words.slice(0, order.length);
    room.game.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); room.game.cur = null; room.game.roundIndex = -1; });

  // drawer strokes → relay to everyone else
  gs.handle('doodle:stroke', (api) => {
    const cur = api.room.game.cur;
    if (!cur || cur.phase !== 'draw' || api.player?.id !== cur.drawerKey) return;
    api.socket.to(api.room.code).emit('doodle:stroke', api.payload);
  });
  gs.handle('doodle:clear', (api) => {
    const cur = api.room.game.cur;
    if (!cur || api.player?.id !== cur.drawerKey) return;
    api.socket.to(api.room.code).emit('doodle:clear');
  });

  gs.handle('doodle:guess', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'draw' || !player || player.spectator) return ack?.({ ok: false });
    if (player.id === cur.drawerKey) return ack?.({ ok: false, reason: 'drawer' });
    if (cur.guessed.has(player.id)) return ack?.({ ok: true, already: true });
    const guess = norm(payload?.text);
    if (!guess) return ack?.({ ok: false });

    if (guess === cur.answerNorm) {
      const order = cur.guessed.size;
      cur.guessed.set(player.id, order);
      const pts = Math.max(150 - order * 30, 60);
      addScore(room, player.id, pts);
      addScore(room, cur.drawerKey, 50); // drawer earns per correct guesser
      ack?.({ ok: true, correct: true, points: pts });
      api.broadcast('doodle:correct', { name: player.name, avatar: player.avatar });
      api.broadcastPlayers();
      const need = api.activePlayers().filter((p) => p.id !== cur.drawerKey).length;
      if (need > 0 && cur.guessed.size >= need) revealRound(room, api);
    } else {
      ack?.({ ok: true, correct: false });
      api.broadcast('doodle:guessFeed', { name: player.name, avatar: player.avatar, text: String(payload.text).slice(0, 40) });
    }
  });

  return gs;
}
