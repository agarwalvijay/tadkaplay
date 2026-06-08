import { Sound } from '/shared/sounds.js';
import { confettiBurst, spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(16);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { lobby: $('screen-lobby'), write: $('screen-write'), vote: $('screen-vote'), reveal: $('screen-reveal'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const promptHTML = (p) => esc(p).replace(/_{2,}/, '<span class="blank">______</span>');
$('muteBtn').onclick = () => { $('muteBtn').textContent = Sound.toggleMute() ? '🔇' : '🔊'; };

function shade(hex, pct) { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct; r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b)); return `rgb(${r},${g},${b})`; }
function avatarEl(av, cls = '') { const d = document.createElement('div'); d.className = 'avatar ' + cls; d.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`; d.textContent = av.emoji; return d; }

// --- lobby ---
let selectedPack = null, myRoom = null;
socket.on('connect', () => { if (myRoom) socket.emit('host:reclaim', { code: myRoom }); });
$('createBtn').onclick = () => { Sound.unlock(); Sound.startMusic(); socket.emit('host:create'); };
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
      chip.innerHTML = `<span>${p.emoji || '✍️'}</span> ${esc(p.name)}`;
      chip.onclick = () => { selectedPack = p.id; socket.emit('host:config', { packId: selectedPack }); [...wrap.children].forEach((c) => c.classList.remove('sel')); chip.classList.add('sel'); Sound.play('tick'); };
      wrap.appendChild(chip);
    });
  } catch {}
}
$('startGameBtn').onclick = () => { Sound.play('go'); socket.emit('host:start', { packId: selectedPack }); };

socket.on('room:players', ({ players }) => {
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

// --- timer ---
let timerInt = null;
function runTimer(ring, text, wrap, seconds) {
  clearInterval(timerInt); const C = 326.7; let left = seconds;
  const upd = () => { ring.style.strokeDashoffset = C * (1 - left / seconds); text.textContent = Math.max(0, left); wrap.classList.toggle('danger', left <= 10); };
  upd(); timerInt = setInterval(() => { left--; if (left < 0) return clearInterval(timerInt); upd(); }, 1000);
}

// --- write ---
socket.on('fill:write', ({ prompt, round, total, seconds }) => {
  show('write');
  $('writeRound').textContent = `Round ${round} / ${total}`;
  $('writeQ').innerHTML = promptHTML(prompt);
  $('writeProg').textContent = '0 / 0';
  runTimer($('writeRing'), $('writeTime'), $('writeTimer'), seconds);
  Sound.play('go');
});
socket.on('fill:writeProgress', ({ submitted, total }) => { $('writeProg').textContent = `${submitted} / ${total}`; if (submitted > 0) Sound.play('tick'); });

// --- vote ---
socket.on('fill:vote', ({ prompt, options, round, total }) => {
  show('vote'); clearInterval(timerInt);
  $('voteRound').textContent = `Round ${round} / ${total}`;
  $('voteQ').innerHTML = promptHTML(prompt);
  $('voteProg').textContent = '0 / 0';
  const list = $('voteOpts'); list.innerHTML = '';
  options.forEach((o, i) => {
    const row = document.createElement('div'); row.className = 'opt'; row.style.animationDelay = `${i * 0.08}s`;
    row.innerHTML = `<div class="letter">${String.fromCharCode(65 + i)}</div><div class="opt-text">${esc(o.text)}</div>`;
    list.appendChild(row);
  });
  Sound.play('reveal');
});
socket.on('fill:voteProgress', ({ voted, total }) => { $('voteProg').textContent = `${voted} / ${total}`; if (voted > 0) Sound.play('tick'); });

// --- reveal ---
socket.on('fill:reveal', ({ prompt, options }) => {
  show('reveal');
  $('revealQ').innerHTML = promptHTML(prompt);
  const list = $('revealOpts'); list.innerHTML = '';
  options.forEach((o, i) => {
    const row = document.createElement('div');
    row.className = 'opt' + (o.fav && o.count > 0 ? ' fav' : '');
    row.style.animationDelay = `${i * 0.3}s`;
    const voters = o.voters.map((v) => `<span class="voter" style="background:${v.avatar.color}">${v.avatar.emoji}</span>`).join('');
    row.innerHTML = `<div class="opt-text">${esc(o.text)} <span class="who">— ${esc(o.author)}</span></div><div class="opt-meta"><span class="count">${o.count}★</span>${voters}</div>`;
    list.appendChild(row);
    setTimeout(() => Sound.play(o.fav && o.count > 0 ? 'fanfare' : 'tick'), i * 300);
  });
});

// --- results ---
socket.on('game:over', ({ results }) => {
  show('results'); clearInterval(timerInt);
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
  Sound.play('drumroll'); setTimeout(() => { Sound.play('fanfare'); confettiBurst(200); }, 700);
  window.ttrack?.('game_finished', { players: results.length });
});
$('playAgainBtn').onclick = () => socket.emit('host:playAgain');
socket.on('game:lobby', () => show('lobby'));
