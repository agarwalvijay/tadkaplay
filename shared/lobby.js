// ===========================================================================
//  GameServer — shared lobby/room framework for Tadka Play games.
//
//  Handles the boilerplate every party game needs: rooms + join codes, QR/join
//  links, players (join, reconnect, ready, disconnect), the lobby → playing →
//  results lifecycle, and the static/route mounting under a URL prefix +
//  Socket.IO namespace. Each game plugs in its own rounds via hooks and custom
//  socket handlers — it never re-implements the lobby.
//
//    const gs = new GameServer(io, app, { basePath:'/bluff', port, publicDir });
//    gs.onStart((room, api) => { ...run the game... });
//    gs.handle('bluff:submitLie', (api) => { ... });
// ===========================================================================
import express from 'express';
import QRCode from 'qrcode';
import os from 'os';
import { join } from 'path';

export function lanAddress() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return i.address;
  }
  return 'localhost';
}

// Build the public base URL from the host's handshake (works on localhost, LAN,
// and behind nginx/tunnels via X-Forwarded-*). PUBLIC_URL overrides.
export function baseUrlFromSocket(socket, port) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const h = socket.handshake.headers;
  const proto = (h['x-forwarded-proto'] || (socket.handshake.secure ? 'https' : 'http')).split(',')[0].trim();
  let host = (h['x-forwarded-host'] || h.host || '').split(',')[0].trim();
  if (!host || /^(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?$/i.test(host)) host = `${lanAddress()}:${port}`;
  return `${proto}://${host}`;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
const HOST_GRACE_MS = 60000; // a brief host disconnect (screen lock) shouldn't kill the room
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class GameServer {
  constructor(io, app, opts) {
    this.opts = {
      autoStartWhenReady: true,
      initRoom: () => ({}),
      initPlayer: () => ({}),
      mapPlayer: () => ({}),
      stateForJoiner: () => null,
      stateForHost: () => null,
      onStart: () => {},
      onReset: () => {},
      onClose: () => {},
      ...opts,
    };
    this.basePath = opts.basePath;
    this.port = opts.port;
    this.nsp = io.of(opts.basePath);
    this.rooms = new Map();
    this.handlers = {};
    this._wire();
    this._serve(app, opts.publicDir);
  }

  // --- game registration -------------------------------------------------
  onStart(fn) { this.opts.onStart = fn; return this; }
  onReset(fn) { this.opts.onReset = fn; return this; }
  handle(event, fn) { this.handlers[event] = fn; return this; }

  // --- helpers a game gets via `api` ------------------------------------
  publicPlayers(room) {
    return [...room.players.values()]
      .filter((p) => !p.spectator)
      .map((p) => ({
        id: p.id, name: p.name, avatar: p.avatar,
        score: p.score, connected: p.connected, ready: p.ready,
        ...this.opts.mapPlayer(p),
      }))
      .sort((a, b) => b.score - a.score);
  }

  broadcastPlayers(room) {
    this.nsp.to(room.code).emit('room:players', { players: this.publicPlayers(room), state: room.state });
  }

  _api(room, extra = {}) {
    return {
      room,
      nsp: this.nsp,
      shuffle,
      broadcast: (event, data) => this.nsp.to(room.code).emit(event, data),
      toHost: (event, data) => this.nsp.to(room.hostId).emit(event, data),
      toSocket: (id, event, data) => this.nsp.to(id).emit(event, data),
      players: () => this.publicPlayers(room),
      activePlayers: () => [...room.players.values()].filter((p) => !p.spectator && p.connected),
      broadcastPlayers: () => this.broadcastPlayers(room),
      setState: (s) => { room.state = s; },
      ...extra,
    };
  }

  _startGame(room, payload) {
    if (room.state !== 'lobby') return;
    if ([...room.players.values()].filter((p) => !p.spectator).length === 0) return;
    room.state = 'playing';
    // host config (e.g. selected pack) persists on the room so an auto-start
    // when everyone readies up uses it too, not just the Start button.
    const cfg = { ...(room.config || {}), ...(payload || {}) };
    this.opts.onStart(room, this._api(room, { payload: cfg }));
  }

  // --- wiring ------------------------------------------------------------
  _wire() {
    this.nsp.on('connection', (socket) => {
      socket.data.role = null;       // 'host' | 'player'
      socket.data.roomCode = null;
      socket.data.playerKey = null;

      socket.on('host:create', async () => {
        let code;
        do { code = Array.from({ length: 4 }, () => ALPHABET[(Math.random() * ALPHABET.length) | 0]).join(''); }
        while (this.rooms.has(code));

        const room = {
          code, hostId: socket.id, players: new Map(), state: 'lobby',
          config: {}, game: this.opts.initRoom(),
        };
        this.rooms.set(code, room);
        socket.data.role = 'host';
        socket.data.roomCode = code;
        socket.join(code);

        const joinUrl = `${baseUrlFromSocket(socket, this.port)}${this.basePath}/play?room=${code}`;
        const qr = await QRCode.toDataURL(joinUrl, {
          margin: 1, width: 480, color: { dark: '#1a0b2e', light: '#ffffff' },
        });
        socket.emit('host:created', { code, joinUrl, qr });
        this.broadcastPlayers(room);
      });

      // host sets pre-game config (e.g. selected pack) — persisted on the room
      socket.on('host:config', (cfg) => {
        const room = this.rooms.get(socket.data.roomCode);
        if (room && room.hostId === socket.id && cfg && typeof cfg === 'object') {
          room.config = { ...room.config, ...cfg };
        }
      });

      socket.on('host:start', (payload) => {
        const room = this.rooms.get(socket.data.roomCode);
        if (room && room.hostId === socket.id) this._startGame(room, payload);
      });

      // host's socket reconnected (e.g. after a screen lock) — re-own the room
      socket.on('host:reclaim', ({ code } = {}) => {
        const room = this.rooms.get(String(code || '').toUpperCase());
        if (!room) { socket.emit('host:reclaimFailed'); return; }
        clearTimeout(room.hostGraceTimer);
        room.hostGone = false;
        room.hostId = socket.id;
        socket.data.role = 'host';
        socket.data.roomCode = room.code;
        socket.join(room.code);
        socket.emit('host:reclaimed', { code: room.code, state: room.state });
        this.broadcastPlayers(room);
        // re-send the current screen so a host that blipped near game-end
        // (e.g. screen lock) catches up — including the results.
        const snap = this.opts.stateForHost(room);
        if (snap) socket.emit(snap.event, snap.data);
      });

      socket.on('host:playAgain', () => {
        const room = this.rooms.get(socket.data.roomCode);
        if (!room || room.hostId !== socket.id) return;
        room.state = 'lobby';
        for (const p of room.players.values()) { p.score = 0; p.ready = false; p.spectator = false; }
        this.opts.onReset(room, this._api(room));
        this.nsp.to(room.code).emit('game:lobby');
        this.broadcastPlayers(room);
      });

      socket.on('player:join', ({ code, name, avatar, playerId }) => {
        code = String(code || '').toUpperCase().trim();
        const room = this.rooms.get(code);
        if (!room) { socket.emit('player:joinError', { reason: 'nofound' }); return; }
        socket.data.role = 'player';
        socket.data.roomCode = code;
        socket.join(code);

        let player = playerId ? room.players.get(playerId) : null;
        if (player) {
          player.connected = true;
          player.socketId = socket.id;
        } else {
          player = {
            id: socket.id, socketId: socket.id,
            name: (name || 'Player').slice(0, 16),
            avatar: avatar || { emoji: '🦊', color: '#ff6b6b' },
            score: 0, connected: true, ready: false,
            spectator: room.state !== 'lobby', // late joiners watch this round
            ...this.opts.initPlayer(),
          };
          room.players.set(player.id, player);
        }
        socket.data.playerKey = player.id;

        socket.emit('player:joined', {
          id: player.id, code, name: player.name, avatar: player.avatar,
          state: room.state, spectator: player.spectator,
        });

        // let the game push current state to a mid-game (spectator) joiner
        const snap = this.opts.stateForJoiner(room, player);
        if (snap) socket.emit(snap.event, snap.data);

        this.broadcastPlayers(room);
      });

      socket.on('player:setReady', ({ ready }) => {
        const room = this.rooms.get(socket.data.roomCode);
        if (!room) return;
        const player = room.players.get(socket.data.playerKey);
        if (!player) return;
        player.ready = !!ready;
        this.broadcastPlayers(room);
        if (this.opts.autoStartWhenReady && room.state === 'lobby') {
          const active = [...room.players.values()].filter((p) => !p.spectator && p.connected);
          if (active.length > 0 && active.every((p) => p.ready)) this._startGame(room);
        }
      });

      // game-specific events
      for (const [event, fn] of Object.entries(this.handlers)) {
        socket.on(event, (payload, ack) => {
          const room = this.rooms.get(socket.data.roomCode);
          if (!room) return;
          const player = room.players.get(socket.data.playerKey);
          fn(this._api(room, {
            socket, player, payload, ack,
            role: socket.data.role,
            isHost: room.hostId === socket.id,
          }));
        });
      }

      socket.on('disconnect', () => {
        const room = this.rooms.get(socket.data.roomCode);
        if (!room) return;
        if (socket.data.role === 'host' && room.hostId === socket.id) {
          // don't kill the room immediately — give the host time to reconnect
          // (timers keep running server-side so the game continues meanwhile)
          room.hostGone = true;
          clearTimeout(room.hostGraceTimer);
          room.hostGraceTimer = setTimeout(() => {
            if (!room.hostGone) return;
            this.nsp.to(room.code).emit('host:left');
            this.opts.onClose(room, this._api(room));
            this.rooms.delete(room.code);
          }, HOST_GRACE_MS);
          return;
        }
        const player = room.players.get(socket.data.playerKey);
        if (player) { player.connected = false; this.broadcastPlayers(room); }
      });
    });
  }

  _serve(app, publicDir) {
    const bp = this.basePath;
    app.get(bp, (_q, r) => r.redirect(`${bp}/host`));
    app.get(`${bp}/`, (_q, r) => r.redirect(`${bp}/host`));
    app.get(`${bp}/play`, (_q, r) => r.sendFile(join(publicDir, 'player.html')));
    app.get(`${bp}/host`, (_q, r) => r.sendFile(join(publicDir, 'host.html')));
    app.use(bp, express.static(publicDir));
  }
}
