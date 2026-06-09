// ===========================================================================
//  NAAM PLACE ANIMAL CHEEZ — the desi classic. A random letter drops; everyone
//  races to fill each category with a word starting with that letter. First to
//  finish hits STOP and everyone else has a few seconds. Unique answers score
//  10, answers others also wrote score 5, blanks/invalid score 0.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { getPack, listPacks, LETTERS } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUNDS = Number(process.env.NPAC_ROUNDS || 5);
const WRITE_SECONDS = Number(process.env.NPAC_WRITE || 90);
const STOP_GRACE = Number(process.env.NPAC_STOP || 8);
const REVEAL_SECONDS = Number(process.env.NPAC_REVEAL || 11);

const norm = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountNpac(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/npac',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ pack: null, used: new Set(), roundIndex: -1, cur: null, timer: null, screen: null }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  app.get('/npac/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };

  function pickLetter(room) {
    const pool = [...LETTERS].filter((l) => !room.game.used.has(l));
    const letter = (pool.length ? pool : [...LETTERS])[Math.floor(Math.random() * (pool.length || LETTERS.length))];
    room.game.used.add(letter);
    return letter;
  }

  function nextRound(room, api) {
    const g = room.game;
    g.roundIndex += 1;
    if (g.roundIndex >= ROUNDS) return finish(room, api);
    for (const p of room.players.values()) p.spectator = false;

    g.cur = { letter: pickLetter(room), answers: new Map(), phase: 'write', stopped: false };
    const data = { letter: g.cur.letter, categories: g.pack.categories, round: g.roundIndex + 1, total: ROUNDS, seconds: WRITE_SECONDS };
    g.screen = { event: 'npac:round', data };
    api.broadcast('npac:round', data);
    api.toHost('npac:writeProgress', { submitted: 0, total: api.activePlayers().length });
    api.broadcastPlayers();
    clearTimer(room);
    g.timer = setTimeout(() => closeRound(room, api), WRITE_SECONDS * 1000);
  }

  function closeRound(room, api) {
    const g = room.game; const cur = g.cur;
    if (!cur || cur.phase !== 'write') return;
    clearTimer(room);
    cur.phase = 'reveal';

    const cats = g.pack.categories;
    const letter = cur.letter.toLowerCase();
    // count valid answers per category for uniqueness
    const counts = cats.map(() => new Map());
    for (const [, arr] of cur.answers) {
      cats.forEach((_, i) => {
        const a = norm(arr[i]);
        if (a && a.startsWith(letter)) counts[i].set(a, (counts[i].get(a) || 0) + 1);
      });
    }

    const rows = [];
    for (const p of api.activePlayers()) {
      const arr = cur.answers.get(p.id) || [];
      let roundTotal = 0;
      const cells = cats.map((_, i) => {
        const raw = String(arr[i] || '').trim();
        const a = norm(raw);
        let status = 'empty', pts = 0;
        if (a) {
          if (!a.startsWith(letter)) status = 'bad';
          else { const c = counts[i].get(a) || 0; pts = c === 1 ? 10 : 5; status = c === 1 ? 'unique' : 'dup'; }
        }
        roundTotal += pts;
        return { text: raw, pts, status };
      });
      addScore(room, p.id, roundTotal);
      rows.push({ playerId: p.id, name: p.name, avatar: p.avatar, cells, roundTotal });
    }

    const data = { letter: cur.letter, categories: cats, rows: rows.sort((a, b) => b.roundTotal - a.roundTotal), scores: api.players() };
    g.screen = { event: 'npac:reveal', data };
    api.broadcast('npac:reveal', data);
    api.broadcastPlayers();
    g.timer = setTimeout(() => nextRound(room, api), REVEAL_SECONDS * 1000);
  }

  function finish(room, api) {
    clearTimer(room);
    room.state = 'results';
    room.game.finalResults = api.players();
    room.game.screen = { event: 'game:over', data: { results: room.game.finalResults } };
    api.broadcast('game:over', { results: room.game.finalResults });
  }

  gs.onStart((room, api) => {
    const g = room.game;
    g.pack = getPack(api.payload?.packId);
    g.used = new Set(); g.roundIndex = -1;
    nextRound(room, api);
  });

  gs.onReset((room) => { clearTimer(room); Object.assign(room.game, { cur: null, roundIndex: -1, used: new Set(), screen: null }); });

  gs.onDisconnect((room, _player, api) => {
    const cur = room.game.cur;
    if (cur && cur.phase === 'write' && cur.answers.size >= api.activePlayers().length) closeRound(room, api);
  });

  gs.handle('npac:submit', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || cur.phase !== 'write' || !player || player.spectator) return ack?.({ ok: false });
    const answers = Array.isArray(payload?.answers) ? payload.answers.map((s) => String(s || '').slice(0, 40)) : [];
    cur.answers.set(player.id, answers);
    ack?.({ ok: true });
    api.toHost('npac:writeProgress', { submitted: cur.answers.size, total: api.activePlayers().length });
    if (!cur.stopped && cur.answers.size < api.activePlayers().length) {
      cur.stopped = true; // first to finish → everyone else gets a short grace
      api.broadcast('npac:stopped', { by: player.name, seconds: STOP_GRACE });
      clearTimer(room);
      room.game.timer = setTimeout(() => closeRound(room, api), STOP_GRACE * 1000);
    }
    if (cur.answers.size >= api.activePlayers().length) closeRound(room, api);
  });

  return gs;
}
