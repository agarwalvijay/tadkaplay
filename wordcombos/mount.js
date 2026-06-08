// ===========================================================================
//  WORD COMBOS — mountable game module.
//
//  Instead of running its own server, the game registers onto a shared
//  Express app + Socket.IO server under a URL prefix and a socket namespace,
//  so the hub (and any future games) all run in ONE process.
//
//    mountWordCombos(app, io, { basePath: '/wordcombos', port: 8080 })
// ===========================================================================
import express from 'express';
import QRCode from 'qrcode';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  generateGrid,
  evaluateSubmission,
  analyzeGrid,
  scoreWord,
  GRID_SIZE,
} from './game.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUND_SECONDS = Number(process.env.ROUND_SECONDS || 90);
const COUNTDOWN_SECONDS = 3;
const HOST_GRACE_MS = 60000; // brief host disconnect (screen lock) shouldn't kill the room

function lanAddress() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

export function mountWordCombos(app, io, { basePath = '/wordcombos', port = process.env.PORT || 8080 } = {}) {
  const nsp = io.of(basePath);
  const rooms = new Map(); // code -> room

  function makeCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code;
    do {
      code = Array.from({ length: 4 }, () =>
        alphabet[Math.floor(Math.random() * alphabet.length)]
      ).join('');
    } while (rooms.has(code));
    return code;
  }

  // Derive the join/QR base URL from the address the host actually reached the
  // server on (its handshake headers). PUBLIC_URL overrides; a localhost host
  // falls back to the LAN IP since phones can't reach localhost.
  function baseUrlFromSocket(socket) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');

    const headers = socket.handshake.headers;
    const proto = (headers['x-forwarded-proto'] ||
      (socket.handshake.secure ? 'https' : 'http')).split(',')[0].trim();
    let host = (headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();

    if (!host || /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i.test(host)) {
      host = `${lanAddress()}:${port}`;
    }
    return `${proto}://${host}`;
  }

  function publicPlayers(room) {
    return [...room.players.values()]
      .filter((p) => !p.spectator)
      .map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        wordCount: p.words.size,
        connected: p.connected,
        ready: p.ready,
      }))
      .sort((a, b) => b.score - a.score || b.wordCount - a.wordCount);
  }

  function broadcastPlayers(room) {
    nsp.to(room.code).emit('room:players', {
      players: publicPlayers(room),
      state: room.state,
    });
  }

  function broadcastLeaderboard(room) {
    nsp.to(room.code).emit('leaderboard:update', { players: publicPlayers(room) });
  }

  function resetForLobby(room) {
    clearTimeout(room.timer);
    clearInterval(room.tick);
    room.state = 'lobby';
    room.grid = null;
    room.analysis = null;
    room.foundAny = new Set();
    for (const p of room.players.values()) {
      p.score = 0;
      p.words = new Map();
      p.ready = false;
      p.combo = 0;
      p.lastFoundAt = 0;
    }
  }

  function startGame(room) {
    if (room.state === 'playing' || room.state === 'countdown') return;
    if ([...room.players.values()].filter((p) => !p.spectator).length === 0) return;

    room.grid = generateGrid();
    room.foundAny = new Set();
    for (const p of room.players.values()) {
      p.score = 0;
      p.words = new Map();
      p.combo = 0;
      p.lastFoundAt = 0;
    }
    room.state = 'countdown';
    nsp.to(room.code).emit('game:countdown', { seconds: COUNTDOWN_SECONDS });
    broadcastPlayers(room);

    // Analyze grid in the background while the countdown plays.
    room.analysis = analyzeGrid(room.grid);

    setTimeout(() => {
      if (room.state !== 'countdown') return;
      room.state = 'playing';
      room.endsAt = Date.now() + ROUND_SECONDS * 1000;
      nsp.to(room.code).emit('game:start', {
        display: room.grid.display,
        size: GRID_SIZE,
        endsAt: room.endsAt,
        duration: ROUND_SECONDS,
        possibleCount: room.analysis.possibleCount,
      });
      broadcastLeaderboard(room);

      room.timer = setTimeout(() => endGame(room), ROUND_SECONDS * 1000);
    }, COUNTDOWN_SECONDS * 1000);
  }

  function endGame(room) {
    clearTimeout(room.timer);
    clearInterval(room.tick);
    if (room.state !== 'playing') return;
    room.state = 'results';

    const players = [...room.players.values()].filter((p) => !p.spectator);

    // Awards
    const byScore = [...players].sort((a, b) => b.score - a.score);
    const longestWord = findExtreme(players, (w) => w.length);
    const bestWord = findExtreme(players, (w) => scoreWord(w));

    // Words only one person found are worth a "unique find" highlight.
    const wordCounts = new Map();
    for (const p of players) {
      for (const w of p.words.keys()) {
        wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
      }
    }

    const results = byScore.map((p, i) => ({
      rank: i + 1,
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      wordCount: p.words.size,
      words: [...p.words.entries()]
        .map(([word, points]) => ({
          word,
          points,
          unique: wordCounts.get(word) === 1,
        }))
        .sort((a, b) => b.points - a.points || b.word.length - a.word.length),
    }));

    room.finalPayload = {
      results,
      possibleCount: room.analysis?.possibleCount ?? 0,
      bestPossible: room.analysis?.best ?? null,
      awards: {
        longestWord,
        bestWord,
      },
    };
    nsp.to(room.code).emit('game:over', room.finalPayload);
  }

  function findExtreme(players, metric) {
    let best = null;
    for (const p of players) {
      for (const [word] of p.words) {
        const v = metric(word);
        if (!best || v > best.value) {
          best = { value: v, word, name: p.name, avatar: p.avatar, id: p.id };
        }
      }
    }
    return best;
  }

  // -------------------------------------------------------------------------
  // Socket handlers (scoped to this game's namespace)
  // -------------------------------------------------------------------------
  nsp.on('connection', (socket) => {
    let role = null; // 'host' | 'player'
    let roomCode = null;

    socket.on('host:create', async () => {
      const code = makeCode();
      const room = {
        code,
        hostId: socket.id,
        players: new Map(),
        state: 'lobby',
        grid: null,
        analysis: null,
        foundAny: new Set(),
      };
      rooms.set(code, room);
      role = 'host';
      roomCode = code;
      socket.join(code);

      const joinUrl = `${baseUrlFromSocket(socket)}${basePath}/play?room=${code}`;
      const qr = await QRCode.toDataURL(joinUrl, {
        margin: 1,
        width: 480,
        color: { dark: '#1a0b2e', light: '#ffffff' },
      });
      socket.emit('host:created', { code, joinUrl, qr, roundSeconds: ROUND_SECONDS });
      broadcastPlayers(room);
    });

    socket.on('host:start', () => {
      const room = rooms.get(roomCode);
      if (room && room.hostId === socket.id) startGame(room);
    });

    // host's socket reconnected (e.g. after a screen lock) — re-own the room
    socket.on('host:reclaim', ({ code } = {}) => {
      const room = rooms.get(String(code || '').toUpperCase());
      if (!room) { socket.emit('host:reclaimFailed'); return; }
      clearTimeout(room.hostGraceTimer);
      room.hostGone = false;
      room.hostId = socket.id;
      role = 'host';
      roomCode = room.code;
      socket.join(room.code);
      socket.emit('host:reclaimed', { code: room.code });
      broadcastPlayers(room);
      if (room.state === 'results' && room.finalPayload) socket.emit('game:over', room.finalPayload);
    });

    socket.on('host:playAgain', () => {
      const room = rooms.get(roomCode);
      if (room && room.hostId === socket.id) {
        resetForLobby(room);
        nsp.to(room.code).emit('game:lobby');
        broadcastPlayers(room);
      }
    });

    socket.on('player:join', ({ code, name, avatar, playerId }) => {
      code = String(code || '').toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        socket.emit('player:joinError', { reason: 'nofound' });
        return;
      }
      role = 'player';
      roomCode = code;
      socket.join(code);

      // Reconnect support: reuse an existing player record by id.
      let player = playerId ? room.players.get(playerId) : null;
      if (player) {
        player.connected = true;
        player.socketId = socket.id;
      } else {
        const id = socket.id;
        player = {
          id,
          socketId: socket.id,
          name: (name || 'Player').slice(0, 16),
          avatar: avatar || { emoji: '🦊', color: '#ff6b6b' },
          score: 0,
          words: new Map(),
          connected: true,
          ready: false,
          spectator: room.state !== 'lobby', // late joiners watch this round
          combo: 0,
          lastFoundAt: 0,
        };
        room.players.set(id, player);
      }
      socket.data.playerKey = player.id;

      socket.emit('player:joined', {
        id: player.id,
        code,
        name: player.name,
        avatar: player.avatar,
        state: room.state,
        spectator: player.spectator,
      });

      // If a round is already in progress, push the live grid to the newcomer.
      if (room.state === 'playing' && room.grid) {
        socket.emit('game:start', {
          display: room.grid.display,
          size: GRID_SIZE,
          endsAt: room.endsAt,
          duration: ROUND_SECONDS,
          possibleCount: room.analysis?.possibleCount ?? 0,
          spectator: true,
        });
      }
      // reconnecting after the round ended → re-send results
      if (room.state === 'results' && room.finalPayload) socket.emit('game:over', room.finalPayload);
      broadcastPlayers(room);
    });

    socket.on('player:setReady', ({ ready }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.get(socket.data.playerKey);
      if (!player) return;
      player.ready = !!ready;
      broadcastPlayers(room);

      // Auto-start when everyone present is ready (and at least 1 player).
      const active = [...room.players.values()].filter((p) => !p.spectator && p.connected);
      if (room.state === 'lobby' && active.length > 0 && active.every((p) => p.ready)) {
        startGame(room);
      }
    });

    socket.on('player:submitWord', ({ path }, ack) => {
      const room = rooms.get(roomCode);
      if (!room || room.state !== 'playing' || !room.grid) {
        ack?.({ ok: false, reason: 'notplaying' });
        return;
      }
      const player = room.players.get(socket.data.playerKey);
      if (!player || player.spectator) {
        ack?.({ ok: false, reason: 'spectator' });
        return;
      }

      const result = evaluateSubmission(room.grid, path, new Set(player.words.keys()));
      if (!result.ok) {
        ack?.(result);
        return;
      }

      // Combo: rapid consecutive finds build a multiplier.
      const now = Date.now();
      if (now - player.lastFoundAt < 4000) player.combo += 1;
      else player.combo = 0;
      player.lastFoundAt = now;
      const multiplier = 1 + Math.min(player.combo, 5) * 0.2;
      const points = Math.round(result.points * multiplier);

      player.words.set(result.word, points);
      player.score += points;
      room.foundAny.add(result.word);

      ack?.({
        ok: true,
        word: result.word,
        points,
        base: result.points,
        combo: player.combo,
        multiplier: Number(multiplier.toFixed(1)),
        total: player.score,
      });

      broadcastLeaderboard(room);
    });

    socket.on('disconnect', () => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (role === 'host' && room.hostId === socket.id) {
        room.hostGone = true;
        clearTimeout(room.hostGraceTimer);
        room.hostGraceTimer = setTimeout(() => {
          if (!room.hostGone) return;
          nsp.to(room.code).emit('host:left');
          clearTimeout(room.timer);
          clearInterval(room.tick);
          rooms.delete(room.code);
        }, HOST_GRACE_MS);
        return;
      }
      const player = room.players.get(socket.data.playerKey);
      if (player) {
        player.connected = false;
        broadcastPlayers(room);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Static assets + friendly routes, all under basePath
  // -------------------------------------------------------------------------
  // Bare /wordcombos (and /wordcombos/) -> /host so relative asset links
  // resolve. Registered before static so it wins over the directory redirect.
  app.get(basePath, (_req, res) => res.redirect(`${basePath}/host`));
  app.get(`${basePath}/`, (_req, res) => res.redirect(`${basePath}/host`));
  app.get(`${basePath}/play`, (_req, res) => res.sendFile(join(__dirname, 'public', 'player.html')));
  app.get(`${basePath}/host`, (_req, res) => res.sendFile(join(__dirname, 'public', 'host.html')));
  app.use(basePath, express.static(join(__dirname, 'public')));

  return { basePath, namespace: basePath };
}
