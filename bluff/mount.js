// ===========================================================================
//  BLUFF ("Jhooth") — Fibbage-style. Each round:
//   1. everyone sees an obscure question and writes a fake answer (a lie)
//   2. the real answer is shuffled in with the lies; everyone votes
//   3. score: +500 each time someone falls for YOUR lie, +1000 for finding truth
//  Round logic plugs into the shared GameServer (lobby/rooms/players).
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUNDS = Number(process.env.BLUFF_ROUNDS || 5);
const LIE_SECONDS = Number(process.env.BLUFF_LIE || 45);
const VOTE_SECONDS = Number(process.env.BLUFF_VOTE || 25);
const REVEAL_SECONDS = Number(process.env.BLUFF_REVEAL || 8);
const FOOL_POINTS = 500;
const TRUTH_POINTS = 1000;

const norm = (s) => String(s).toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const nameOf = (room, key) => room.players.get(key)?.name ?? '???';
const avatarOf = (room, key) => room.players.get(key)?.avatar ?? null;
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountBluff(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/bluff',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ timer: null, cur: null, prompts: [], roundIndex: -1 }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  // pack list for the host's picker
  app.get('/bluff/api/packs', (_req, res) => res.json(listPacks()));

  function clearTimer(room) { clearTimeout(room.game.timer); room.game.timer = null; }

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= g.prompts.length) return finish(room, api);

    // everyone (including late joiners) plays from this round on
    for (const p of room.players.values()) p.spectator = false;

    const prompt = g.prompts[g.roundIndex];
    g.cur = { q: prompt.q, answer: prompt.a, phase: 'lie', lies: new Map(), votes: new Map(), knewIt: new Set(), options: null };
    const liePayload = { q: prompt.q, round: g.roundIndex + 1, total: g.prompts.length, seconds: LIE_SECONDS };
    g.screen = { event: 'bluff:lie', data: liePayload };
    api.broadcast('bluff:lie', liePayload);
    api.toHost('bluff:lieProgress', { submitted: 0, total: api.activePlayers().length });
    api.broadcastPlayers();
    clearTimer(room);
    room.game.timer = setTimeout(() => closeLies(room, api), LIE_SECONDS * 1000);
  }

  function closeLies(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'lie') return;
    clearTimer(room);
    cur.phase = 'vote';

    // merge duplicate lies (case-insensitive) → one option crediting all authors
    const merged = new Map(); // normalized -> { text, authors:Set }
    for (const [key, text] of cur.lies) {
      const k = norm(text);
      if (!merged.has(k)) merged.set(k, { text, authors: new Set() });
      merged.get(k).authors.add(key);
    }
    let id = 0;
    const opts = [{ id: id++, text: cur.answer, truth: true, authors: new Set() }];
    for (const { text, authors } of merged.values()) opts.push({ id: id++, text, truth: false, authors });
    cur.options = api.shuffle(opts);

    const votePayload = {
      q: cur.q,
      options: cur.options.map((o) => ({ id: o.id, text: o.text })),
      round: room.game.roundIndex + 1, total: room.game.prompts.length, seconds: VOTE_SECONDS,
    };
    room.game.screen = { event: 'bluff:vote', data: votePayload };
    api.broadcast('bluff:vote', votePayload);
    api.toHost('bluff:voteProgress', { voted: 0, total: eligibleVoters(room, api) });
    room.game.timer = setTimeout(() => closeVotes(room, api), VOTE_SECONDS * 1000);
  }

  function eligibleVoters(room, api) {
    // everyone active who didn't already write the exact truth
    return api.activePlayers().filter((p) => !room.game.cur.knewIt.has(p.id)).length;
  }

  function closeVotes(room, api) {
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'vote') return;
    clearTimer(room);
    cur.phase = 'reveal';

    const byId = new Map(cur.options.map((o) => [o.id, { ...o, voters: [] }]));
    for (const [voterKey, optId] of cur.votes) {
      const opt = byId.get(optId);
      if (!opt) continue;
      opt.voters.push(voterKey);
      if (opt.truth) addScore(room, voterKey, TRUTH_POINTS);
      else for (const a of opt.authors) addScore(room, a, FOOL_POINTS);
    }
    for (const k of cur.knewIt) addScore(room, k, TRUTH_POINTS);

    const options = [...byId.values()].map((o) => ({
      text: o.text,
      truth: o.truth,
      authors: [...o.authors].map((k) => nameOf(room, k)),
      voters: o.voters.map((k) => ({ name: nameOf(room, k), avatar: avatarOf(room, k) })),
    }));

    const revealPayload = {
      q: cur.q, answer: cur.answer, options,
      knewIt: [...cur.knewIt].map((k) => nameOf(room, k)),
      scores: api.players(),
      round: room.game.roundIndex + 1, total: room.game.prompts.length,
    };
    room.game.screen = { event: 'bluff:reveal', data: revealPayload };
    api.broadcast('bluff:reveal', revealPayload);
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

  // --- lifecycle + handlers ---------------------------------------------
  gs.onStart((room, api) => {
    const pack = getPack(api.payload?.packId) || PACKS[0];
    room.game.packName = pack.name;
    room.game.prompts = api.shuffle(pack.prompts).slice(0, Math.min(ROUNDS, pack.prompts.length));
    room.game.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); room.game.cur = null; room.game.roundIndex = -1; room.game.screen = null; });

  gs.handle('bluff:submitLie', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'lie' || !player || player.spectator) return ack?.({ ok: false });
    const text = String(payload?.text || '').trim().slice(0, 80);
    if (!text) return ack?.({ ok: false, reason: 'empty' });
    if (norm(text) === norm(cur.answer)) {
      cur.knewIt.add(player.id);
      ack?.({ ok: true, knewIt: true });
    } else {
      cur.lies.set(player.id, text);
      ack?.({ ok: true });
    }
    api.toHost('bluff:lieProgress', { submitted: cur.lies.size + cur.knewIt.size, total: api.activePlayers().length });
    const submitted = cur.lies.size + cur.knewIt.size;
    if (submitted >= api.activePlayers().length) closeLies(room, api);
  });

  gs.handle('bluff:submitVote', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'vote' || !player || player.spectator) return ack?.({ ok: false });
    if (cur.knewIt.has(player.id)) return ack?.({ ok: false, reason: 'knew' });
    const opt = cur.options.find((o) => o.id === Number(payload?.optionId));
    if (!opt) return ack?.({ ok: false });
    if (opt.authors.has(player.id)) return ack?.({ ok: false, reason: 'own' });
    cur.votes.set(player.id, opt.id);
    ack?.({ ok: true });
    api.toHost('bluff:voteProgress', { voted: cur.votes.size, total: eligibleVoters(room, api) });
    if (cur.votes.size >= eligibleVoters(room, api)) closeVotes(room, api);
  });

  return gs;
}
