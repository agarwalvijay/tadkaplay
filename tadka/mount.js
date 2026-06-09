// ===========================================================================
//  TADKA TASHAN — a real-time rhythm co-op. A kadhai heats on the big screen;
//  spice cues drop and the room taps in time. Good timing keeps it sizzling
//  (and scores you points); misses raise the shared BURN meter. Burn it and
//  the round ends. Survive every cue → tadka served! Heat level is a pack.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { getPack, listPacks, SPICES } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAD_MS = Number(process.env.TADKA_LEAD || 3200);
const SPEED = Number(process.env.TADKA_SPEED || 1);   // <1 = faster (tests)
const CUES_OVERRIDE = Number(process.env.TADKA_CUES || 0);

const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };
const lerp = (a, b, t) => a + (b - a) * t;

export function mountTadka(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/tadka',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ pack: null, phase: 'lobby', burn: 0, combo: 0, maxCombo: 0, cueIndex: 0, cur: null, timer: null, screen: null }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  app.get('/tadka/api/packs', (_req, res) => res.json(listPacks()));

  const clearTimer = (room) => { clearTimeout(room.game.timer); room.game.timer = null; };
  const active = (api) => api.activePlayers().length;

  function fireCue(room, api) {
    const g = room.game;
    if (g.cueIndex >= g.pack.cues) return serve(room, api);
    const id = g.cueIndex;
    const spice = SPICES[id % SPICES.length];
    const windowMs = g.pack.windowMs;
    g.cur = { id, start: Date.now(), windowMs, taps: new Map() };
    const payload = { id, spice, windowMs, index: id + 1, total: g.pack.cues };
    g.screen = { event: 'tadka:cue', data: { ...payload, phase: 'play', burn: g.burn, combo: g.combo } };
    api.broadcast('tadka:cue', payload);
    g.cueIndex += 1;
    clearTimer(room);
    g.timer = setTimeout(() => closeCue(room, api), windowMs);
  }

  function closeCue(room, api) {
    const g = room.game;
    const cur = g.cur; if (!cur) return;
    const total = Math.max(1, active(api));
    const hits = cur.taps.size;
    const ratio = hits / total;

    let quality;
    if (ratio >= 0.75) { g.burn = Math.max(0, g.burn - g.pack.burnCool); g.combo += 1; quality = 'perfect'; }
    else if (ratio >= 0.4) { g.burn = Math.min(100, g.burn + 3); g.combo = 0; quality = 'ok'; }
    else { g.burn = Math.min(100, g.burn + g.pack.burnMiss); g.combo = 0; quality = 'bad'; }
    g.maxCombo = Math.max(g.maxCombo, g.combo);

    for (const [key, timing] of cur.taps) {
      const base = timing === 'perfect' ? 150 : 100;
      addScore(room, key, base + g.combo * 10);
    }

    const result = { id: cur.id, hits, total, burn: g.burn, combo: g.combo, quality };
    g.screen = { event: 'tadka:cue', data: { id: cur.id, phase: 'between', burn: g.burn, combo: g.combo } };
    api.broadcast('tadka:result', result);
    api.broadcastPlayers();
    g.cur = null;

    if (g.burn >= 100) return finish(room, api, false);
    const t = g.cueIndex / Math.max(1, g.pack.cues - 1);
    const interval = lerp(g.pack.startInterval, g.pack.endInterval, Math.min(1, t));
    clearTimer(room);
    g.timer = setTimeout(() => fireCue(room, api), interval);
  }

  function serve(room, api) { finish(room, api, true); }

  function finish(room, api, success) {
    const g = room.game;
    clearTimer(room);
    g.phase = 'results';
    room.state = 'results';
    g.finalResults = api.players();
    const data = { results: g.finalResults, success, burn: Math.round(g.burn), maxCombo: g.maxCombo };
    g.screen = { event: 'game:over', data };
    api.broadcast('game:over', data);
  }

  gs.onStart((room, api) => {
    const g = room.game;
    const base = getPack(api.payload?.packId);
    g.pack = { ...base, startInterval: base.startInterval * SPEED, endInterval: base.endInterval * SPEED, windowMs: base.windowMs * SPEED };
    if (CUES_OVERRIDE) g.pack.cues = CUES_OVERRIDE;
    g.phase = 'play'; g.burn = 0; g.combo = 0; g.maxCombo = 0; g.cueIndex = 0; g.cur = null;
    const intro = { phase: 'intro', pack: g.pack, leadMs: LEAD_MS };
    g.screen = { event: 'tadka:start', data: intro };
    api.broadcast('tadka:start', intro);
    api.broadcastPlayers();
    clearTimer(room);
    g.timer = setTimeout(() => fireCue(room, api), LEAD_MS);
  });

  gs.onReset((room) => { clearTimer(room); Object.assign(room.game, { phase: 'lobby', burn: 0, combo: 0, maxCombo: 0, cueIndex: 0, cur: null, screen: null }); });
  gs.onDisconnect(() => {});

  gs.handle('tadka:tap', (api) => {
    const { room, player, payload, ack } = api;
    const cur = room.game.cur;
    if (!cur || !player || player.spectator) return ack?.({ ok: false });
    if (Number(payload?.cueId) !== cur.id || cur.taps.has(player.id)) return ack?.({ ok: false });
    const dt = Date.now() - cur.start;
    if (dt > cur.windowMs) return ack?.({ ok: false, timing: 'late' });
    const timing = dt >= cur.windowMs * 0.55 ? 'perfect' : 'good';
    cur.taps.set(player.id, timing);
    ack?.({ ok: true, timing });
  });

  return gs;
}
