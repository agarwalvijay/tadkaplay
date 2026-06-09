// ===========================================================================
//  BHEDIYA (the wolf) — social deduction. Everyone sees the CATEGORY; all but
//  one player also get the secret WORD. The lone wolf must bluff. Each player
//  gives a one-word clue, then the room votes on who the wolf is. Catch the
//  wolf → townsfolk score; wolf escapes → wolf scores.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUNDS = Number(process.env.BHEDIYA_ROUNDS || 4);
const CLUE_SECONDS = Number(process.env.BHEDIYA_CLUE || 45);
const VOTE_SECONDS = Number(process.env.BHEDIYA_VOTE || 30);
const REVEAL_SECONDS = Number(process.env.BHEDIYA_REVEAL || 9);
const CORRECT_VOTE = 100;
const WOLF_ESCAPE = 300;

const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const avatarOf = (room, key) => room.players.get(key)?.avatar ?? null;
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountBhediya(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/bhediya',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ pack: null, words: [], roundIndex: -1, cur: null, timer: null, hostScreen: null, playerScreen: null }),
    stateForHost: (room) => room.game.hostScreen || null,
    stateForJoiner: (room) => room.game.playerScreen || null,
  });

  app.get('/bhediya/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };
  const roleFor = (room, key) => {
    const cur = room.game.cur;
    if (!cur) return { phase: 'none' };
    const wolf = key === cur.impostorKey;
    return { category: cur.category, word: wolf ? null : cur.word, wolf, phase: cur.phase,
      round: room.game.roundIndex + 1, total: room.game.words.length, seconds: CLUE_SECONDS };
  };

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.words.length) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    const active = api.activePlayers();
    const impostor = active[Math.floor(Math.random() * active.length)];
    g.cur = { category: g.pack.name, word: g.words[g.roundIndex], impostorKey: impostor.id, clues: new Map(), votes: new Map(), phase: 'clue' };

    for (const p of active) {
      const sock = room.players.get(p.id)?.socketId;
      if (sock) api.toSocket(sock, 'bhediya:role', roleFor(room, p.id));
    }
    g.hostScreen = { event: 'bhediya:clue', data: { category: g.cur.category, round: g.roundIndex + 1, total: g.words.length, seconds: CLUE_SECONDS } };
    g.playerScreen = null; // players are driven by their private role during the clue phase
    api.toHost('bhediya:clue', g.hostScreen.data);
    api.toHost('bhediya:clueProgress', { submitted: 0, total: active.length });
    api.broadcastPlayers();
    clearTimer(room);
    g.timer = setTimeout(() => closeClues(room, api), CLUE_SECONDS * 1000);
  }

  function closeClues(room, api) {
    const g = room.game; const cur = g.cur;
    if (!cur || cur.phase !== 'clue') return;
    clearTimer(room);
    cur.phase = 'vote';
    const clues = api.shuffle([...cur.clues.entries()].map(([key, clue]) => ({ playerId: key, name: nameOf(room, key), avatar: avatarOf(room, key), clue })));
    const data = { clues, round: g.roundIndex + 1, total: g.words.length, seconds: VOTE_SECONDS };
    g.hostScreen = g.playerScreen = { event: 'bhediya:vote', data };
    api.broadcast('bhediya:vote', data);
    api.toHost('bhediya:voteProgress', { voted: 0, total: api.activePlayers().length });
    g.timer = setTimeout(() => closeVotes(room, api), VOTE_SECONDS * 1000);
  }

  function closeVotes(room, api) {
    const g = room.game; const cur = g.cur;
    if (!cur || cur.phase !== 'vote') return;
    clearTimer(room);
    cur.phase = 'reveal';

    const counts = new Map();
    for (const [, suspect] of cur.votes) counts.set(suspect, (counts.get(suspect) || 0) + 1);
    let top = 0; for (const v of counts.values()) top = Math.max(top, v);
    const topSuspects = [...counts.entries()].filter(([, v]) => v === top).map(([k]) => k);
    const caught = top > 0 && topSuspects.length === 1 && topSuspects[0] === cur.impostorKey;

    for (const [voter, suspect] of cur.votes) if (suspect === cur.impostorKey) addScore(room, voter, CORRECT_VOTE);
    if (!caught) addScore(room, cur.impostorKey, WOLF_ESCAPE);

    const players = api.activePlayers().map((p) => ({
      playerId: p.id, name: p.name, avatar: p.avatar,
      clue: cur.clues.get(p.id) || '—',
      votes: counts.get(p.id) || 0,
      votedFor: cur.votes.has(p.id) ? nameOf(room, cur.votes.get(p.id)) : null,
      isWolf: p.id === cur.impostorKey,
    }));
    const data = { wolfId: cur.impostorKey, wolfName: nameOf(room, cur.impostorKey), word: cur.word, caught, players, scores: api.players() };
    g.hostScreen = g.playerScreen = { event: 'bhediya:reveal', data };
    api.broadcast('bhediya:reveal', data);
    api.broadcastPlayers();
    g.timer = setTimeout(() => nextRound(room, api), REVEAL_SECONDS * 1000);
  }

  function finish(room, api) {
    clearTimer(room);
    room.state = 'results';
    room.game.finalResults = api.players();
    room.game.hostScreen = room.game.playerScreen = { event: 'game:over', data: { results: room.game.finalResults } };
    api.broadcast('game:over', { results: room.game.finalResults });
  }

  gs.onStart((room, api) => {
    const g = room.game;
    g.pack = getPack(api.payload?.packId);
    g.words = api.shuffle(g.pack.words).slice(0, Math.min(ROUNDS, g.pack.words.length));
    g.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); Object.assign(room.game, { cur: null, roundIndex: -1, hostScreen: null, playerScreen: null }); });

  gs.onDisconnect((room, _player, api) => {
    const cur = room.game.cur;
    if (!cur) return;
    if (cur.phase === 'clue' && cur.clues.size >= api.activePlayers().length) closeClues(room, api);
    else if (cur.phase === 'vote' && cur.votes.size >= api.activePlayers().length) closeVotes(room, api);
  });

  gs.handle('bhediya:whoami', (api) => { api.socket.emit('bhediya:role', roleFor(api.room, api.player?.id)); });

  gs.handle('bhediya:submitClue', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'clue' || !player || player.spectator) return ack?.({ ok: false });
    const text = String(payload?.text || '').trim().slice(0, 24);
    if (!text) return ack?.({ ok: false, reason: 'empty' });
    cur.clues.set(player.id, text);
    ack?.({ ok: true });
    api.toHost('bhediya:clueProgress', { submitted: cur.clues.size, total: api.activePlayers().length });
    if (cur.clues.size >= api.activePlayers().length) closeClues(room, api);
  });

  gs.handle('bhediya:castVote', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'vote' || !player || player.spectator) return ack?.({ ok: false });
    const suspect = String(payload?.playerId || '');
    if (suspect === player.id || !room.players.has(suspect)) return ack?.({ ok: false });
    cur.votes.set(player.id, suspect);
    ack?.({ ok: true });
    api.toHost('bhediya:voteProgress', { voted: cur.votes.size, total: api.activePlayers().length });
    if (cur.votes.size >= api.activePlayers().length) closeVotes(room, api);
  });

  return gs;
}
