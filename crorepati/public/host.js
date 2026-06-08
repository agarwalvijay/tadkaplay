import { Sound } from '/shared/sounds.js';
import { confettiBurst, spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(12);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { lobby: $('screen-lobby'), play: $('screen-play'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rupees = (n) => '₹' + n.toLocaleString('en-IN');
$('muteBtn').onclick = () => { $('muteBtn').textContent = Sound.toggleMute() ? '🔇' : '🔊'; };

function shade(hex, pct) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct; r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); return `rgb(${r},${g},${b})`; }
function avatarEl(av, cls = '') { const d = document.createElement('div'); d.className = 'avatar ' + cls; d.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`; d.textContent = av.emoji; return d; }

// --- lobby ---
let selectedPack = null;
let myRoom = null;
socket.on('connect', () => { if (myRoom) socket.emit('host:reclaim', { code: myRoom }); });
$('createBtn').onclick = () => { Sound.unlock(); socket.emit('host:create'); };
socket.on('host:created', ({ code, joinUrl, qr }) => {
  $('preStart').classList.add('hidden'); $('lobbyBody').classList.remove('hidden');
  $('qrImg').src = qr; $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, ''); $('roomCode').textContent = code;
  myRoom = code; loadPacks(); window.ttrack?.('game_created');
});
async function loadPacks() {
  try {
    const packs = await fetch(NS + '/api/packs').then((r) => r.json());
    const wrap = $('packs'); wrap.innerHTML = ''; selectedPack = packs[0]?.id || null;
    socket.emit('host:config', { packId: selectedPack });
    packs.forEach((p) => {
      const chip = document.createElement('div'); chip.className = 'pack-chip' + (p.id === selectedPack ? ' sel' : '');
      chip.innerHTML = `<span>${p.emoji || '❓'}</span> ${esc(p.name)}`;
      chip.onclick = () => { selectedPack = p.id; socket.emit('host:config', { packId: selectedPack }); [...wrap.children].forEach((c) => c.classList.remove('sel')); chip.classList.add('sel'); Sound.play('tick'); };
      wrap.appendChild(chip);
    });
  } catch {}
}
$('startGameBtn').onclick = () => { Sound.play('go'); socket.emit('host:start', { packId: selectedPack }); };

function renderScoreboard(el, players, opts = {}) {
  el.innerHTML = '';
  players.forEach((p, i) => {
    const row = document.createElement('div'); row.className = 'sb-row' + (opts.winner && i === 0 ? ' winner' : ''); row.style.animationDelay = `${i * 0.06}s`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = (opts.winner && i === 0) ? '👑' : '#' + (i + 1);
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = rupees(p.score || 0);
    row.append(rank, avatarEl(p.avatar), name, score); el.appendChild(row);
  });
}
socket.on('room:players', ({ players }) => {
  if (!screens.lobby.classList.contains('hidden')) {
    $('playerCount').textContent = players.length;
    $('startGameBtn').disabled = players.length === 0;
    const grid = $('lobbyPlayers'); grid.innerHTML = '';
    $('emptyHint').classList.toggle('hidden', players.length > 0);
    for (const p of players) {
      const card = document.createElement('div'); card.className = 'player-card' + (p.ready ? ' ready' : '');
      card.appendChild(avatarEl(p.avatar));
      const n = document.createElement('div'); n.className = 'pname'; n.textContent = p.name;
      const s = document.createElement('div'); s.className = 'pstatus'; s.textContent = p.ready ? '✓ Ready' : 'waiting…';
      card.append(n, s); grid.appendChild(card);
    }
  } else if (!screens.play.classList.contains('hidden')) {
    renderScoreboard($('scoreboard'), players);
  }
});

// --- timer ---
let timerInt = null;
function runTimer(seconds) {
  clearInterval(timerInt); const C = 326.7; let left = seconds;
  const upd = () => { $('ring').style.strokeDashoffset = C * (1 - left / seconds); $('timeText').textContent = Math.max(0, left); $('timer').classList.toggle('danger', left <= 5); };
  upd(); timerInt = setInterval(() => { left--; if (left < 0) return clearInterval(timerInt); upd(); if (left <= 5 && left > 0) Sound.play('tick'); }, 1000);
}

// --- question ---
let optEls = [];
socket.on('kbc:question', ({ round, total, q, options, value, seconds }) => {
  show('play');
  $('round').textContent = `Q${round} / ${total}`;
  $('value').textContent = rupees(value);
  $('prog').textContent = '0 / 0';
  $('q').textContent = q;
  const list = $('opts'); list.innerHTML = ''; optEls = [];
  options.forEach((o, i) => {
    const row = document.createElement('div'); row.className = 'opt'; row.style.animationDelay = `${i * 0.08}s`;
    row.innerHTML = `<div class="letter">${String.fromCharCode(65 + i)}</div><div class="opt-text">${esc(o)}</div><div class="opt-meta"><span class="tally"></span></div>`;
    list.appendChild(row); optEls.push(row);
  });
  runTimer(seconds); Sound.play('go');
});
socket.on('kbc:progress', ({ answered, total }) => { $('prog').textContent = `${answered} / ${total}`; if (answered > 0) Sound.play('tick'); });

socket.on('kbc:reveal', ({ answer, tally }) => {
  clearInterval(timerInt);
  optEls.forEach((row, i) => {
    row.querySelector('.tally').textContent = tally[i] ? `${tally[i]}` : '';
    if (i === answer) row.classList.add('correct');
    else row.classList.add('dim');
  });
  Sound.play('fanfare');
});

// --- results ---
socket.on('game:over', ({ results }) => {
  show('results'); clearInterval(timerInt);
  renderScoreboard($('finalBoard'), results, { winner: true });
  Sound.play('drumroll'); setTimeout(() => { Sound.play('fanfare'); confettiBurst(200); }, 700);
  window.ttrack?.('game_finished', { players: results.length });
});
$('playAgainBtn').onclick = () => socket.emit('host:playAgain');
socket.on('game:lobby', () => show('lobby'));
