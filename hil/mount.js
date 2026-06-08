// ===========================================================================
//  HIL MAT! — a real-time tilt co-op. Everyone tilts their phone; the server
//  averages the room's tilt and forwards it to the HOST, which runs the
//  physics (a wobbly platform; the cargo slides and can fall off). It's a team
//  challenge: keep the cargo on and reach the goal. Cargo is a pack.
// ===========================================================================
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { GameServer } from '../shared/lobby.js';
import { PACKS, getPack, listPacks } from './packs/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUND_SECONDS = Number(process.env.HIL_SECONDS || 40);
const TICK_MS = 50;

const addScore = (room, key, pts) => { const p = room.players.get(key); if (p) p.score += pts; };

export function mountHil(app, io, { port }) {
  const gs = new GameServer(io, app, {
    basePath: '/hil',
    port,
    publicDir: join(__dirname, 'public'),
    initRoom: () => ({ pack: null, tilts: new Map(), tickTimer: null, safety: null, phase: 'lobby', screen: null }),
    stateForJoiner: (room) => room.game.screen || null,
    stateForHost: (room) => room.game.screen || null,
  });

  app.get('/hil/api/packs', (_req, res) => res.json(listPacks()));

  function stopLoops(room) {
    clearInterval(room.game.tickTimer); room.game.tickTimer = null;
    clearTimeout(room.game.safety); room.game.safety = null;
  }

  gs.onStart((room, api) => {
    const pack = getPack(api.payload?.packId) || PACKS[0];
    room.game.pack = pack;
    room.game.phase = 'playing';
    room.game.tilts = new Map();

    const payload = { pack, seconds: ROUND_SECONDS };
    room.game.screen = { event: 'hil:start', data: payload };
    api.broadcast('hil:start', payload);
    api.broadcastPlayers();

    // forward the room's average tilt to the host ~20x/s
    stopLoops(room);
    room.game.tickTimer = setInterval(() => {
      const now = Date.now();
      const vals = [...room.game.tilts.values()].filter((v) => now - v.t < 1200).map((v) => v.g);
      const angle = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      api.toHost('hil:tilt', { angle });
    }, TICK_MS);
    // safety: if the host never reports a result, end anyway
    room.game.safety = setTimeout(() => finish(room, api, { success: false, remaining: 0 }), (ROUND_SECONDS + 12) * 1000);
  });

  function finish(room, api, { success, remaining }) {
    if (room.game.phase === 'results') return;
    stopLoops(room);
    room.game.phase = 'results';
    room.state = 'results';
    const pack = room.game.pack || {};
    const teamScore = (remaining || 0) * 200 + (success ? 600 : 0);
    for (const p of room.players.values()) if (!p.spectator) p.score = teamScore;
    room.game.finalResults = api.players();
    const data = { results: room.game.finalResults, success: !!success, remaining: remaining || 0, total: pack.count || 0, item: pack.item || '🟡', unit: pack.unit || 'items', goal: pack.goal || 'home' };
    room.game.screen = { event: 'game:over', data };
    api.broadcast('game:over', data);
  }

  gs.onReset((room) => { stopLoops(room); room.game.phase = 'lobby'; room.game.screen = null; room.game.tilts = new Map(); });
  gs.onDisconnect(() => {});

  // a phone reports its tilt (gamma, degrees)
  gs.handle('hil:tilt', (api) => {
    if (api.room.game.phase !== 'playing' || !api.player) return;
    const g = Number(api.payload?.g);
    if (Number.isFinite(g)) api.room.game.tilts.set(api.player.id, { g, t: Date.now() });
  });

  // the host's physics reports the outcome
  gs.handle('hil:finish', (api) => {
    if (!api.isHost) return;
    finish(api.room, api, { success: !!api.payload?.success, remaining: Number(api.payload?.remaining) || 0 });
  });

  return gs;
}
