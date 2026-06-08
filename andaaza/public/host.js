import { Sound } from '/shared/sounds.js';
import { confettiBurst, spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(12);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { lobby: $('screen-lobby'), play: $('screen-play'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
      chip.innerHTML = `<span>${p.emoji || '🔮'}</span> ${esc(p.name)}`;
      chip.onclick = () => { selectedPack = p.id; socket.emit('host:config', { packId: selectedPack }); [...wrap.children].forEach((c) => c.classList.remove('sel')); chip.classList.add('sel'); Sound.play('tick'); };
      wrap.appendChild(chip);
    });
  } catch {}
}
$('startGameBtn').onclick = () => { Sound.play('go'); socket.emit('host:start', { packId: selectedPack }); };

function renderScoreboard(el, players, opts = {}) {
  el.innerHTML = '';
  players.forEach((p, i) => {
    const off = p.connected === false;
    const row = document.createElement('div');
    row.className = 'sb-row' + (opts.winner && i === 0 ? ' winner' : '') + (off ? ' offline' : '');
    row.style.animationDelay = `${i * 0.05}s`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = (opts.winner && i === 0) ? '👑' : '#' + (i + 1);
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = (p.score || 0).toLocaleString();
    row.append(rank, avatarEl(p.avatar, off ? 'offline' : ''), name, score);
    el.appendChild(row);
  });
}

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
function runTimer(seconds) {
  clearInterval(timerInt); const C = 326.7; let left = seconds;
  const upd = () => { $('ring').style.strokeDashoffset = C * (1 - left / seconds); $('timeText').textContent = Math.max(0, left); $('timer').classList.toggle('danger', left <= 8); };
  upd(); timerInt = setInterval(() => { left--; if (left < 0) return clearInterval(timerInt); upd(); }, 1000);
}

function setSpectrum(spectrum) {
  $('endLeft').textContent = spectrum.left;
  $('endRight').textContent = spectrum.right;
}

// --- clue phase ---
socket.on('andaaza:round', ({ round, total, clueGiverName, spectrum }) => {
  show('play');
  $('round').textContent = `Round ${round} / ${total}`;
  $('clueLine').innerHTML = `🔮 <b>${esc(clueGiverName)}</b> is giving a clue…`;
  setSpectrum(spectrum);
  $('bigClue').classList.add('hidden');
  $('target').classList.add('hidden'); $('target').style.left = '50%';
  $('markers').innerHTML = '';
  $('progWrap').classList.add('hidden');
  $('scoreboard').classList.add('hidden');
  $('statusLine').textContent = 'Thinking of a clue…';
  runTimer(35); Sound.play('go');
});

// --- guess phase ---
socket.on('andaaza:guess', ({ clue, clueGiverName, spectrum, seconds }) => {
  setSpectrum(spectrum);
  $('clueLine').innerHTML = `<b>${esc(clueGiverName)}</b>'s clue:`;
  $('bigClue').textContent = `“${clue}”`;
  $('bigClue').classList.remove('hidden');
  $('statusLine').textContent = '📱 Everyone — drag your slider to guess!';
  $('progWrap').classList.remove('hidden'); $('prog').textContent = '0 / 0';
  runTimer(seconds); Sound.play('reveal');
});
socket.on('andaaza:guessProgress', ({ guessed, total }) => { $('prog').textContent = `${guessed} / ${total}`; if (guessed > 0) Sound.play('tick'); });

// --- reveal ---
socket.on('andaaza:reveal', ({ target, spectrum, clue, guesses, clueGiver, scores }) => {
  clearInterval(timerInt);
  setSpectrum(spectrum);
  $('bigClue').textContent = `“${clue}”`; $('bigClue').classList.remove('hidden');
  $('progWrap').classList.add('hidden');
  $('statusLine').innerHTML = `🎯 Bullseye was here — <b>${esc(clueGiver.name)}</b> earned <b>+${clueGiver.points}</b>`;

  const tgt = $('target');
  tgt.style.left = `${target}%`;
  tgt.innerHTML = '<span class="bull">🎯</span>';
  tgt.classList.remove('hidden');

  const layer = $('markers'); layer.innerHTML = '';
  guesses.forEach((g, i) => {
    const m = document.createElement('div'); m.className = 'marker'; m.style.left = '50%';
    m.appendChild(avatarEl(g.avatar));
    const pts = document.createElement('div'); pts.className = 'pts'; pts.textContent = g.points ? `+${g.points}` : '0';
    m.appendChild(pts);
    layer.appendChild(m);
    setTimeout(() => { m.style.left = `${g.value}%`; }, 120 + i * 120);
  });

  renderScoreboard($('scoreboard'), scores);
  $('scoreboard').classList.remove('hidden');
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
