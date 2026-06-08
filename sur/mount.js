// ===========================================================================
//  SUR — a collective music jam. Each phone is a desi instrument; taps stream
//  to the HOST which synthesizes the whole band (so latency never matters).
//  Flow: JAM (everyone plays) → SOLO LAP (each player gets the spotlight) →
//  VOTE (best musician) → results.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { INSTRUMENTS, getInstrument } from './public/instruments-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const JAM_SECONDS = Number(process.env.SUR_JAM || 30);
const SOLO_SECONDS = Number(process.env.SUR_SOLO || 7);
const VOTE_SECONDS = Number(process.env.SUR_VOTE || 20);
const VOTE_POINTS = 300;
const JAM_BONUS = 100;

const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountSur(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/sur',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, phase: 'lobby', order: [], soloIndex: 0, jammers: new Set(), votes: new Map(), screen: null }),
    mapPlayer: (p) => ({ instrument: p.instId || null }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };

  function startJam(room, api) {
    const g = room.game;
    g.phase = 'jam'; g.jammers = new Set();
    const payload = { phase: 'jam', seconds: JAM_SECONDS };
    g.screen = { event: 'sur:phase', data: payload };
    api.broadcast('sur:phase', payload);
    api.broadcastPlayers();
    clearTimer(room);
    g.timer = setTimeout(() => startSolos(room, api), JAM_SECONDS * 1000);
  }

  function startSolos(room, api) {
    room.game.phase = 'solo';
    room.game.soloIndex = 0;
    nextSolo(room, api);
  }
  function nextSolo(room, api) {
    const g = room.game;
    if (g.soloIndex >= g.order.length) return startVote(room, api);
    const key = g.order[g.soloIndex];
    const payload = { phase: 'solo', soloId: key, soloName: nameOf(room, key), index: g.soloIndex + 1, total: g.order.length, seconds: SOLO_SECONDS };
    g.screen = { event: 'sur:phase', data: payload };
    api.broadcast('sur:phase', payload);
    clearTimer(room);
    g.timer = setTimeout(() => { g.soloIndex += 1; nextSolo(room, api); }, SOLO_SECONDS * 1000);
  }

  function startVote(room, api) {
    const g = room.game;
    g.phase = 'vote'; g.votes = new Map();
    const players = api.players().map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }));
    const payload = { phase: 'vote', options: players, seconds: VOTE_SECONDS };
    g.screen = { event: 'sur:phase', data: payload };
    api.broadcast('sur:phase', payload);
    api.toHost('sur:voteProgress', { voted: 0, total: api.activePlayers().length });
    clearTimer(room);
    g.timer = setTimeout(() => finish(room, api), VOTE_SECONDS * 1000);
  }

  function finish(room, api) {
    const g = room.game;
    clearTimer(room);
    for (const [, votee] of g.votes) addScore(room, votee, VOTE_POINTS);
    for (const key of g.jammers) addScore(room, key, JAM_BONUS);
    room.state = 'results';
    g.phase = 'results';
    g.finalResults = api.players();
    g.screen = { event: 'game:over', data: { results: g.finalResults } };
    api.broadcast('game:over', { results: g.finalResults });
  }

  gs.onStart((room, api) => {
    const active = api.activePlayers();
    active.forEach((p, i) => { p.instId = INSTRUMENTS[i % INSTRUMENTS.length].id; });
    room.game.order = active.map((p) => p.id);
    // tell each player their instrument
    for (const p of active) {
      const sock = room.players.get(p.id)?.socketId;
      if (sock) api.toSocket(sock, 'sur:instrument', { instrument: getInstrument(p.instId) });
    }
    startJam(room, api);
  });

  gs.onReset((room) => {
    clearTimer(room);
    room.game.phase = 'lobby'; room.game.screen = null; room.game.jammers = new Set(); room.game.votes = new Map();
    for (const p of room.players.values()) p.instId = null;
  });

  gs.onDisconnect((room, _player, api) => {
    if (room.game.phase === 'vote' && room.game.votes.size >= api.activePlayers().length) finish(room, api);
  });

  // a phone asks which instrument it has (on join / reconnect)
  gs.handle('sur:whoami', (api) => {
    const inst = api.player?.instId ? getInstrument(api.player.instId) : null;
    api.socket.emit('sur:instrument', { instrument: inst });
  });

  // a tap → relay to the host to be synthesized
  gs.handle('sur:hit', (api) => {
    const { room, player, payload } = api;
    if (!player || (room.game.phase !== 'jam' && room.game.phase !== 'solo')) return;
    room.game.jammers.add(player.id);
    api.toHost('sur:play', { playerId: player.id, name: player.name, inst: player.instId, pad: Number(payload?.pad) || 0 });
  });

  gs.handle('sur:castVote', (api) => {
    const { room, player, payload, ack } = api;
    if (room.game.phase !== 'vote' || !player) return ack?.({ ok: false });
    const votee = String(payload?.playerId || '');
    if (votee === player.id || !room.players.has(votee)) return ack?.({ ok: false });
    room.game.votes.set(player.id, votee);
    ack?.({ ok: true });
    api.toHost('sur:voteProgress', { voted: room.game.votes.size, total: api.activePlayers().length });
    if (room.game.votes.size >= api.activePlayers().length) finish(room, api);
  });

  return gs;
}
