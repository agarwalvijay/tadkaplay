import { confettiBurst, spawnBgLetters } from '/shared/fx.js';
import { createBand } from '/sur/instruments.js';
import { getInstrument } from '/sur/instruments-data.js';

spawnBgLetters(10);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { lobby: $('screen-lobby'), play: $('screen-play'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };

const band = createBand();

function shade(hex, pct) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct; r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); return `rgb(${r},${g},${b})`; }
function avatarEl(av, cls = '') { const d = document.createElement('div'); d.className = 'avatar ' + cls; d.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`; d.textContent = av.emoji; return d; }

// --- lobby ---
let myRoom = null, lineup = [];
socket.on('connect', () => { if (myRoom) socket.emit('host:reclaim', { code: myRoom }); });
$('createBtn').onclick = () => { band.unlock(); socket.emit('host:create'); };
socket.on('host:created', ({ code, joinUrl, qr }) => {
  $('preStart').classList.add('hidden'); $('lobbyBody').classList.remove('hidden');
  $('qrImg').src = qr; $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, ''); $('roomCode').textContent = code;
  myRoom = code; window.ttrack?.('game_created');
});
$('startGameBtn').onclick = () => socket.emit('host:start');

socket.on('room:players', ({ players }) => {
  lineup = players;
  if (!screens.lobby.classList.contains('hidden')) {
    $('playerCount').textContent = players.length;
    $('startGameBtn').disabled = players.length < 2;
    const grid = $('lobbyPlayers'); grid.innerHTML = '';
    $('emptyHint').classList.toggle('hidden', players.length > 0);
    for (const p of players) {
      const off = p.connected === false;
      const card = document.createElement('div'); card.className = 'player-card' + (p.ready ? ' ready' : '') + (off ? ' offline' : '');
      card.appendChild(avatarEl(p.avatar, off ? 'offline' : ''));
      const n = document.createElement('div'); n.className = 'pname'; n.textContent = p.name;
      const s = document.createElement('div'); s.className = 'pstatus'; s.textContent = off ? 'away' : (p.ready ? '✓ Ready' : 'waiting…');
      card.append(n, s); grid.appendChild(card);
    }
  }
});

// --- band visual ---
let cards = {};
function renderBand(players) {
  const wrap = $('band'); wrap.innerHTML = ''; cards = {};
  players.forEach((p) => {
    const card = document.createElement('div'); card.className = 'band-card' + (p.connected === false ? ' offline' : '');
    card.appendChild(avatarEl(p.avatar));
    const inst = document.createElement('div'); inst.className = 'inst'; inst.textContent = p.instrument ? getInstrument(p.instrument).emoji : '🎵';
    const nm = document.createElement('div'); nm.className = 'bname'; nm.textContent = p.name;
    card.append(inst, nm); wrap.appendChild(card); cards[p.id] = card;
  });
}
function flash(id) { const c = cards[id]; if (!c) return; c.classList.add('playing'); clearTimeout(c._t); c._t = setTimeout(() => c.classList.remove('playing'), 160); }
function spotlight(id) { for (const k in cards) cards[k].classList.toggle('spotlight', k === id); }
function clearSpot() { for (const k in cards) cards[k].classList.remove('spotlight'); }

// --- timer ---
let timerInt = null;
function runTimer(seconds) {
  clearInterval(timerInt); const C = 326.7; let left = seconds;
  const upd = () => { $('ring').style.strokeDashoffset = C * (1 - left / seconds); $('timeText').textContent = Math.max(0, left); $('timer').classList.toggle('danger', left <= 5); };
  upd(); timerInt = setInterval(() => { left--; if (left < 0) return clearInterval(timerInt); upd(); }, 1000);
}

// --- phases ---
socket.on('sur:phase', (p) => {
  if (p.phase === 'jam') {
    show('play'); $('voteWrap').classList.add('hidden');
    $('phaseBanner').textContent = '🎶 JAM TIME — everyone play!';
    renderBand(lineup); clearSpot();
    band.startLoop();
    runTimer(p.seconds);
  } else if (p.phase === 'solo') {
    $('phaseBanner').textContent = `🎤 ${p.soloName}'s solo!`;
    spotlight(p.soloId);
    runTimer(p.seconds);
  } else if (p.phase === 'vote') {
    $('phaseBanner').textContent = '🗳️ Vote for the best musician!';
    clearSpot(); band.stopLoop();
    $('voteWrap').classList.remove('hidden'); $('voteProg').textContent = '0 / 0';
    runTimer(p.seconds);
  }
});
socket.on('sur:play', ({ playerId, inst, pad }) => { band.hit(inst, pad); flash(playerId); });
socket.on('sur:voteProgress', ({ voted, total }) => { $('voteProg').textContent = `${voted} / ${total}`; });

// --- results ---
socket.on('game:over', ({ results }) => {
  show('results'); clearInterval(timerInt); band.stopLoop();
  const sb = $('scoreboard'); sb.innerHTML = '';
  results.forEach((p, i) => {
    const off = p.connected === false;
    const row = document.createElement('div');
    row.className = 'sb-row' + (i === 0 ? ' winner' : '') + (off ? ' offline' : '');
    row.style.animationDelay = `${i * 0.12}s`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = i === 0 ? '👑' : '#' + (i + 1);
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = (p.score || 0).toLocaleString();
    row.append(rank, avatarEl(p.avatar, off ? 'offline' : ''), name, score);
    sb.appendChild(row);
  });
  [0, 0.18, 0.36, 0.54].forEach((d, i) => setTimeout(() => band.hit('bells', i % 2), d * 1000));
  confettiBurst(200);
  window.ttrack?.('game_finished', { players: results.length });
});
$('playAgainBtn').onclick = () => { band.stopLoop(); socket.emit('host:playAgain'); };
socket.on('game:lobby', () => { band.stopLoop(); show('lobby'); });
