// ===========================================================================
//  KHAALI JAGAH (fill-in-the-blank) — Quiplash-style. Each round:
//   1. everyone fills the blank in a prompt with something funny
//   2. all answers are shown anonymously; everyone votes for their favourite
//      (not their own)
//   3. points = votes your answer received, plus a "crowd favourite" bonus
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUNDS = Number(process.env.FILL_ROUNDS || 5);
const WRITE_SECONDS = Number(process.env.FILL_WRITE || 45);
const VOTE_SECONDS = Number(process.env.FILL_VOTE || 25);
const REVEAL_SECONDS = Number(process.env.FILL_REVEAL || 8);
const POINTS_PER_VOTE = 100;
const FAV_BONUS = 100;

const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const avatarOf = (room, key) => room.players.get(key)?.avatar ?? null;
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountFill(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/fill',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, cur: null, prompts: [], roundIndex: -1 }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  app.get('/fill/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };
  const eligibleVoters = (room, api) => api.activePlayers().length;

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.prompts.length) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    g.cur = { prompt: g.prompts[g.roundIndex], answers: new Map(), votes: new Map(), options: null, phase: 'write' };
    const payload = { prompt: g.cur.prompt, round: g.roundIndex + 1, total: g.prompts.length, seconds: WRITE_SECONDS };
    g.screen = { event: 'fill:write', data: payload };
    api.broadcast('fill:write', payload);
    api.toHost('fill:writeProgress', { submitted: 0, total: api.activePlayers().length });
    api.broadcastPlayers();
    clearTimer(room);
    room.game.timer = setTimeout(() => closeWrite(room, api), WRITE_SECONDS * 1000);
  }

  function closeWrite(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'write') return;
    clearTimer(room);

    let id = 0;
    cur.options = api.shuffle([...cur.answers.entries()].map(([authorKey, text]) => ({ id: id++, text, authorKey })));
    cur.phase = 'vote';

    if (cur.options.length < 2) { revealRound(room, api); return; } // nothing to vote on

    const payload = {
      prompt: cur.prompt,
      options: cur.options.map((o) => ({ id: o.id, text: o.text })),
      round: room.game.roundIndex + 1, total: room.game.prompts.length, seconds: VOTE_SECONDS,
    };
    room.game.screen = { event: 'fill:vote', data: payload };
    api.broadcast('fill:vote', payload);
    api.toHost('fill:voteProgress', { voted: 0, total: eligibleVoters(room, api) });
    room.game.timer = setTimeout(() => revealRound(room, api), VOTE_SECONDS * 1000);
  }

  function revealRound(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase === 'reveal') return;
    clearTimer(room);
    cur.phase = 'reveal';

    const counts = new Map(); // optionId -> [voterKeys]
    for (const [voterKey, optId] of cur.votes) {
      if (!counts.has(optId)) counts.set(optId, []);
      counts.get(optId).push(voterKey);
    }
    let max = 0;
    for (const o of cur.options) max = Math.max(max, (counts.get(o.id) || []).length);
    for (const o of cur.options) {
      const v = (counts.get(o.id) || []).length;
      if (v) addScore(room, o.authorKey, v * POINTS_PER_VOTE);
      if (max > 0 && v === max) addScore(room, o.authorKey, FAV_BONUS);
    }
    const options = cur.options.map((o) => {
      const voters = counts.get(o.id) || [];
      return {
        text: o.text,
        author: nameOf(room, o.authorKey),
        avatar: avatarOf(room, o.authorKey),
        voters: voters.map((k) => ({ name: nameOf(room, k), avatar: avatarOf(room, k) })),
        count: voters.length,
        fav: max > 0 && voters.length === max,
      };
    }).sort((a, b) => b.count - a.count);

    const payload = { prompt: cur.prompt, options, scores: api.players() };
    room.game.screen = { event: 'fill:reveal', data: payload };
    api.broadcast('fill:reveal', payload);
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
    room.game.prompts = api.shuffle(pack.prompts).slice(0, Math.min(ROUNDS, pack.prompts.length));
    room.game.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); room.game.cur = null; room.game.roundIndex = -1; room.game.screen = null; });

  gs.onDisconnect((room, _player, api) => {
    const cur = room.game.cur;
    if (!cur) return;
    if (cur.phase === 'write' && cur.answers.size >= api.activePlayers().length) closeWrite(room, api);
    else if (cur.phase === 'vote' && cur.votes.size >= eligibleVoters(room, api)) revealRound(room, api);
  });

  gs.handle('fill:submit', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'write' || !player || player.spectator) return ack?.({ ok: false });
    const text = String(payload?.text || '').trim().slice(0, 100);
    if (!text) return ack?.({ ok: false, reason: 'empty' });
    cur.answers.set(player.id, text);
    ack?.({ ok: true });
    api.toHost('fill:writeProgress', { submitted: cur.answers.size, total: api.activePlayers().length });
    if (cur.answers.size >= api.activePlayers().length) closeWrite(room, api);
  });

  gs.handle('fill:castVote', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'vote' || !player || player.spectator) return ack?.({ ok: false });
    const opt = cur.options.find((o) => o.id === Number(payload?.optionId));
    if (!opt) return ack?.({ ok: false });
    if (opt.authorKey === player.id) return ack?.({ ok: false, reason: 'own' });
    cur.votes.set(player.id, opt.id);
    ack?.({ ok: true });
    api.toHost('fill:voteProgress', { voted: cur.votes.size, total: eligibleVoters(room, api) });
    if (cur.votes.size >= eligibleVoters(room, api)) revealRound(room, api);
  });

  return gs;
}
