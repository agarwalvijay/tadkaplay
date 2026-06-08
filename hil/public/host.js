import { Sound } from '/shared/sounds.js';
import { confettiBurst, spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(10);
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
      chip.innerHTML = `<span>${p.emoji || '🟡'}</span> ${esc(p.name)}`;
      chip.onclick = () => { selectedPack = p.id; socket.emit('host:config', { packId: selectedPack }); [...wrap.children].forEach((c) => c.classList.remove('sel')); chip.classList.add('sel'); Sound.play('tick'); };
      wrap.appendChild(chip);
    });
  } catch {}
}
$('startGameBtn').onclick = () => { Sound.play('go'); socket.emit('host:start', { packId: selectedPack }); };
socket.on('room:players', ({ players }) => {
  if (!screens.lobby.classList.contains('hidden')) {
    $('playerCount').textContent = players.length;
    $('startGameBtn').disabled = players.length < 1;
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

// --- physics ---
const canvas = $('stage'); const ctx = canvas.getContext('2d');
function fit() { const r = canvas.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
window.addEventListener('resize', fit);
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

const G = 0.0022, FRICTION = 0.94, MAX_TILT = 0.5;
let pack = null, items = [], curTilt = 0, targetTilt = 0, running = false, finished = false, startAt = 0, roundMs = 40000, raf = 0, bumpTimer = null;

socket.on('hil:start', ({ pack: p, seconds }) => {
  pack = p; roundMs = (seconds || 40) * 1000;
  $('goalName').textContent = p.goal || 'home';
  items = Array.from({ length: p.count }, (_, i) => ({ pos: (i - (p.count - 1) / 2) * 0.18, vel: 0, alive: true }));
  curTilt = 0; targetTilt = 0; finished = false; running = true; startAt = performance.now();
  $('progFill').style.width = '0%';
  show('play'); fit();
  clearInterval(bumpTimer); bumpTimer = setInterval(bump, 3200);
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
});
socket.on('hil:tilt', ({ angle }) => { targetTilt = Math.max(-1, Math.min(1, (angle || 0) / 35)) * MAX_TILT; });

function bump() {
  if (!running) return;
  items.forEach((it) => { if (it.alive) it.vel += (Math.random() * 2 - 1) * 0.013; });
  const f = $('bumpFlash'); f.classList.remove('hidden'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = 'pop-in 0.25s both';
  setTimeout(() => f.classList.add('hidden'), 700);
  Sound.play('warn');
}

function loop() {
  if (!running) return;
  curTilt += (targetTilt - curTilt) * 0.12;
  const a = Math.sin(curTilt) * G * (pack.slip || 1);
  let alive = 0;
  for (const it of items) {
    if (!it.alive) continue;
    it.vel += a; it.vel *= FRICTION; it.pos += it.vel;
    if (Math.abs(it.pos) > 1.02) { it.alive = false; Sound.play('error'); } else alive++;
  }
  const progress = Math.min(1, (performance.now() - startAt) / roundMs);
  $('progFill').style.width = `${progress * 100}%`;
  $('remaining').textContent = `${alive} / ${pack.count} ${pack.unit}`;
  render(alive);

  if (!finished) {
    if (alive === 0) end(false, 0);
    else if (progress >= 1) end(true, alive);
  }
  raf = requestAnimationFrame(loop);
}
function render(alive) {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H * 0.6, L = W * 0.72, PT = 18;
  // a little support pole
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(cx - 5, cy, 10, H - cy);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(curTilt);
  ctx.fillStyle = pack.accent || '#ffb000';
  roundRect(-L / 2, -PT / 2, L, PT, 9); ctx.fill();
  ctx.font = `${Math.round(H * 0.1)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  for (const it of items) if (it.alive) ctx.fillText(pack.item, it.pos * (L / 2), -PT / 2 - 3);
  ctx.restore();
}
function end(success, remaining) {
  finished = true; running = false;
  clearInterval(bumpTimer); cancelAnimationFrame(raf);
  socket.emit('hil:finish', { success, remaining });
}

// --- results ---
socket.on('game:over', ({ results, success, remaining, total, item, unit }) => {
  running = false; cancelAnimationFrame(raf); clearInterval(bumpTimer);
  show('results');
  $('resultTitle').innerHTML = success ? '<span class="title-gradient">DELIVERED! 🎉</span>' : '<span class="title-gradient">SPILLED! 😅</span>';
  $('bigResult').textContent = success
    ? `You saved ${remaining}/${total} ${unit} ${item.repeat(Math.max(1, remaining))}`
    : `The cargo tipped over… ${item}`;
  const sb = $('scoreboard'); sb.innerHTML = '';
  results.forEach((p) => {
    const off = p.connected === false;
    const row = document.createElement('div'); row.className = 'sb-row' + (off ? ' offline' : '');
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = '🤝';
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = (p.score || 0).toLocaleString();
    row.append(rank, avatarEl(p.avatar, off ? 'offline' : ''), name, score);
    sb.appendChild(row);
  });
  if (success) { Sound.play('fanfare'); confettiBurst(220); }
  window.ttrack?.('game_finished', { players: results.length });
});
$('playAgainBtn').onclick = () => socket.emit('host:playAgain');
socket.on('game:lobby', () => { running = false; cancelAnimationFrame(raf); clearInterval(bumpTimer); show('lobby'); });
