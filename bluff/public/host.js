import { Sound } from '/shared/sounds.js';
import { confettiBurst, spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(16);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);

const $ = (id) => document.getElementById(id);
const screens = {
  lobby: $('screen-lobby'), lie: $('screen-lie'), vote: $('screen-vote'),
  reveal: $('screen-reveal'), results: $('screen-results'),
};
const show = (name) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== name); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

$('muteBtn').onclick = () => { $('muteBtn').textContent = Sound.toggleMute() ? '🔇' : '🔊'; };

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
function avatarEl(av, cls = '') {
  const d = document.createElement('div');
  d.className = 'avatar ' + cls;
  d.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`;
  d.textContent = av.emoji;
  return d;
}

// --- lobby ---------------------------------------------------------------
let selectedPack = null;
$('createBtn').onclick = () => { Sound.unlock(); socket.emit('host:create'); };

socket.on('host:created', ({ code, joinUrl, qr }) => {
  $('preStart').classList.add('hidden');
  $('lobbyBody').classList.remove('hidden');
  $('qrImg').src = qr;
  $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, '');
  $('roomCode').textContent = code;
  loadPacks();
});

async function loadPacks() {
  try {
    const packs = await fetch(NS + '/api/packs').then((r) => r.json());
    const wrap = $('packs'); wrap.innerHTML = '';
    selectedPack = packs[0]?.id || null;
    packs.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'pack-chip' + (p.id === selectedPack ? ' sel' : '');
      chip.innerHTML = `<span>${p.emoji || '🎲'}</span> ${esc(p.name)}`;
      chip.onclick = () => {
        selectedPack = p.id;
        [...wrap.children].forEach((c) => c.classList.remove('sel'));
        chip.classList.add('sel');
        Sound.play('tick');
      };
      wrap.appendChild(chip);
    });
  } catch { /* no packs endpoint — start uses default */ }
}

$('startGameBtn').onclick = () => { Sound.play('go'); socket.emit('host:start', { packId: selectedPack }); };

socket.on('room:players', ({ players }) => {
  if (!screens.lobby.classList.contains('hidden')) {
    $('playerCount').textContent = players.length;
    $('startGameBtn').disabled = players.length === 0;
    const grid = $('lobbyPlayers'); grid.innerHTML = '';
    $('emptyHint').classList.toggle('hidden', players.length > 0);
    for (const p of players) {
      const card = document.createElement('div');
      card.className = 'player-card' + (p.ready ? ' ready' : '');
      card.appendChild(avatarEl(p.avatar));
      const n = document.createElement('div'); n.className = 'pname'; n.textContent = p.name;
      const s = document.createElement('div'); s.className = 'pstatus'; s.textContent = p.ready ? '✓ Ready' : 'waiting…';
      card.append(n, s); grid.appendChild(card);
    }
  }
});

// --- timer ---------------------------------------------------------------
let timerInt = null;
function runTimer(ring, text, wrap, seconds) {
  clearInterval(timerInt);
  const C = 326.7; let left = seconds;
  const upd = () => { ring.style.strokeDashoffset = C * (1 - left / seconds); text.textContent = Math.max(0, left); wrap.classList.toggle('danger', left <= 10); };
  upd();
  timerInt = setInterval(() => { left--; if (left < 0) return clearInterval(timerInt); upd(); }, 1000);
}

// --- lie phase -----------------------------------------------------------
socket.on('bluff:lie', ({ q, round, total, seconds }) => {
  show('lie');
  $('lieRound').textContent = `Round ${round} / ${total}`;
  $('lieQ').textContent = q;
  $('lieProg').textContent = '0 / 0';
  runTimer($('lieRing'), $('lieTime'), $('lieTimer'), seconds);
  Sound.play('go');
});
socket.on('bluff:lieProgress', ({ submitted, total }) => {
  $('lieProg').textContent = `${submitted} / ${total}`;
  if (submitted > 0) Sound.play('tick');
});

// --- vote phase ----------------------------------------------------------
socket.on('bluff:vote', ({ q, options, round, total }) => {
  show('vote');
  clearInterval(timerInt);
  $('voteRound').textContent = `Round ${round} / ${total}`;
  $('voteQ').textContent = q;
  $('voteProg').textContent = '0 / 0';
  const list = $('voteOpts'); list.innerHTML = '';
  options.forEach((o, i) => {
    const row = document.createElement('div');
    row.className = 'opt'; row.style.animationDelay = `${i * 0.08}s`;
    row.innerHTML = `<div class="letter">${String.fromCharCode(65 + i)}</div><div class="opt-text">${esc(o.text)}</div>`;
    list.appendChild(row);
  });
  Sound.play('reveal');
});
socket.on('bluff:voteProgress', ({ voted, total }) => {
  $('voteProg').textContent = `${voted} / ${total}`;
  if (voted > 0) Sound.play('tick');
});

// --- reveal --------------------------------------------------------------
socket.on('bluff:reveal', ({ q, options }) => {
  show('reveal');
  $('revealQ').textContent = q;
  const list = $('revealOpts'); list.innerHTML = '';
  options.forEach((o, i) => {
    const row = document.createElement('div');
    row.className = 'opt' + (o.truth ? ' truth' : (o.voters.length ? ' fooled' : ''));
    row.style.animationDelay = `${i * 0.35}s`;
    const voters = o.voters.map((v) => `<span class="voter" style="background:${v.avatar.color}">${v.avatar.emoji}</span>`).join('');
    const tag = o.truth
      ? `<span class="tag" style="background:rgba(6,214,160,.3)">TRUTH ✓</span>`
      : (o.authors.length ? `<span class="who">lie by ${esc(o.authors.join(', '))}</span>` : '');
    row.innerHTML = `<div class="letter">${String.fromCharCode(65 + i)}</div><div class="opt-text">${esc(o.text)}</div><div class="opt-meta">${tag}${voters}</div>`;
    list.appendChild(row);
    setTimeout(() => Sound.play(o.truth ? 'fanfare' : 'tick'), i * 350);
  });
});

// --- results -------------------------------------------------------------
socket.on('game:over', ({ results }) => {
  show('results');
  clearInterval(timerInt);
  const sb = $('scoreboard'); sb.innerHTML = '';
  results.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'sb-row' + (i === 0 ? ' winner' : '');
    row.style.animationDelay = `${i * 0.12}s`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = i === 0 ? '👑' : '#' + (i + 1);
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = p.score.toLocaleString();
    row.append(rank, avatarEl(p.avatar), name, score);
    sb.appendChild(row);
  });
  Sound.play('drumroll');
  setTimeout(() => { Sound.play('fanfare'); confettiBurst(200); }, 700);
});

$('playAgainBtn').onclick = () => socket.emit('host:playAgain');
socket.on('game:lobby', () => show('lobby'));
