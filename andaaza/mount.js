// ===========================================================================
//  ANDAAZA (Spectrum) — Wavelength-style. Each round one player is the
//  Clue-Giver: they secretly see a target on a spectrum (e.g. Mild ↔ Spicy)
//  and give a short clue; everyone else drags a slider to guess where it is.
//  Closer = more points; the clue-giver scores on how close the group got.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks, dealSpectrums } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MAX_ROUNDS = Number(process.env.ANDAAZA_ROUNDS || 8);
const CLUE_SECONDS = Number(process.env.ANDAAZA_CLUE || 35);
const GUESS_SECONDS = Number(process.env.ANDAAZA_GUESS || 30);
const REVEAL_SECONDS = Number(process.env.ANDAAZA_REVEAL || 8);

const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const avatarOf = (room, key) => room.players.get(key)?.avatar ?? null;
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };
const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

// distance (0–100) → points, with a satisfying bullseye
function scoreGuess(dist) {
  if (dist <= 4) return 100;
  if (dist <= 9) return 70;
  if (dist <= 16) return 40;
  if (dist <= 25) return 15;
  return 0;
}

export function mountAndaaza(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/andaaza',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, cur: null, spectrums: [], order: [], roundIndex: -1 }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  app.get('/andaaza/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.order.length) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    const clueGiverKey = g.order[g.roundIndex];
    const spectrum = g.spectrums[g.roundIndex];
    const target = Math.floor(8 + Math.random() * 84); // 8..92, avoid the edges
    g.cur = { clueGiverKey, spectrum, target, clue: null, guesses: new Map(), phase: 'clue' };

    const roundPayload = {
      round: g.roundIndex + 1, total: g.order.length,
      clueGiverId: clueGiverKey, clueGiverName: nameOf(room, clueGiverKey),
      spectrum, seconds: CLUE_SECONDS,
    };
    g.screen = { event: 'andaaza:round', data: roundPayload };
    api.broadcast('andaaza:round', roundPayload);
    // only the clue-giver sees where the target is
    const cgSocket = room.players.get(clueGiverKey)?.socketId;
    if (cgSocket) api.toSocket(cgSocket, 'andaaza:target', { target });
    api.broadcastPlayers();
    clearTimer(room);
    room.game.timer = setTimeout(() => revealRound(room, api), CLUE_SECONDS * 1000);
  }

  function startGuessing(room, api) {
    const cur = room.game.cur;
    const guessPayload = {
      clue: cur.clue, spectrum: cur.spectrum,
      clueGiverId: cur.clueGiverKey, clueGiverName: nameOf(room, cur.clueGiverKey),
      round: room.game.roundIndex + 1, total: room.game.order.length, seconds: GUESS_SECONDS,
    };
    room.game.screen = { event: 'andaaza:guess', data: guessPayload };
    api.broadcast('andaaza:guess', guessPayload);
    api.toHost('andaaza:guessProgress', { guessed: 0, total: guessersNeeded(room, api) });
    clearTimer(room);
    room.game.timer = setTimeout(() => revealRound(room, api), GUESS_SECONDS * 1000);
  }

  const guessersNeeded = (room, api) =>
    api.activePlayers().filter((p) => p.id !== room.game.cur.clueGiverKey).length;

  function revealRound(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase === 'reveal') return;
    clearTimer(room);
    cur.phase = 'reveal';

    const guesses = [];
    let sum = 0, n = 0;
    for (const [key, value] of cur.guesses) {
      const pts = scoreGuess(Math.abs(value - cur.target));
      addScore(room, key, pts);
      sum += pts; n += 1;
      guesses.push({ name: nameOf(room, key), avatar: avatarOf(room, key), value, points: pts });
    }
    const cgPoints = n ? Math.round(sum / n) : 0; // clue-giver rewarded for group accuracy
    addScore(room, cur.clueGiverKey, cgPoints);

    const payload = {
      target: cur.target, spectrum: cur.spectrum, clue: cur.clue,
      guesses,
      clueGiver: { name: nameOf(room, cur.clueGiverKey), points: cgPoints },
      scores: api.players(),
    };
    room.game.screen = { event: 'andaaza:reveal', data: payload };
    api.broadcast('andaaza:reveal', payload);
    api.broadcastPlayers();
    room.game.timer = setTimeout(() => nextRound(room, api), REVEAL_SECONDS * 1000);
  }

  function finish(room, api) {
    clearTimer(room);
    room.state = 'results';
    room.game.finalResults = api.players();
    room.game.screen = { event: 'game:over', data: { results: room.game.finalResults } };
    api.broadcast('game:over', { results: room.game.finalResults });
  }

  gs.onStart((room, api) => {
    const pack = getPack(api.payload?.packId) || PACKS[0];
    const active = api.activePlayers().map((p) => p.id);
    room.game.order = api.shuffle(active).slice(0, Math.min(active.length, MAX_ROUNDS));
    room.game.spectrums = dealSpectrums(pack, room.game.order.length);
    room.game.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); room.game.cur = null; room.game.roundIndex = -1; room.game.screen = null; });

  gs.onDisconnect((room, player, api) => {
    const cur = room.game.cur;
    if (!cur) return;
    if (player.id === cur.clueGiverKey) {
      // clue-giver bailed → resolve the round (reveal scores whatever's in)
      if (cur.phase !== 'reveal') revealRound(room, api);
      return;
    }
    if (cur.phase === 'guess' && cur.guesses.size >= guessersNeeded(room, api)) revealRound(room, api);
  });

  gs.handle('andaaza:clue', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'clue' || player?.id !== cur.clueGiverKey) return ack?.({ ok: false });
    const text = String(payload?.text || '').trim().slice(0, 28);
    if (!text) return ack?.({ ok: false, reason: 'empty' });
    cur.clue = text;
    cur.phase = 'guess';
    ack?.({ ok: true });
    startGuessing(room, api);
  });

  gs.handle('andaaza:guess', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'guess' || !player || player.spectator) return ack?.({ ok: false });
    if (player.id === cur.clueGiverKey) return ack?.({ ok: false, reason: 'clue-giver' });
    cur.guesses.set(player.id, clamp(Number(payload?.value)));
    ack?.({ ok: true });
    api.toHost('andaaza:guessProgress', { guessed: cur.guesses.size, total: guessersNeeded(room, api) });
    if (cur.guesses.size >= guessersNeeded(room, api)) revealRound(room, api);
  });

  return gs;
}
