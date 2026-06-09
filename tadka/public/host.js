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
$('createBtn').onclick = () => { Sound.unlock(); socket.emit('host:create'); };
socket.on('host:created', ({ code, joinUrl, qr }) => {
  $('preStart').classList.add('hidden'); $('lobbyBody').classList.remove('hidden');
  $('qrImg').src = qr; $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, ''); $('roomCode').textContent = code;
  myRoom = code; loadPacks(); window.ttrack?.('game_created');
});
async function loadPacks() {
  try {
    const packs = await fetch(NS + '/api/packs').then((r) => r.json());
    const wrap = $('packs'); wrap.innerHTML = ''; selectedPack = packs[1]?.id || packs[0]?.id;
    socket.emit('host:config', { packId: selectedPack });
    packs.forEach((p) => {
      const chip = document.createElement('div'); chip.className = 'pack-chip' + (p.id === selectedPack ? ' sel' : '');
      chip.innerHTML = `<span>${p.emoji || '🌶️'}</span> ${esc(p.name)}`;
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

// --- play ---
let spices = {}, cuesTotal = 0;
function bigFeedback(text, cls) {
  const fb = $('cueFeedback'); fb.className = 'cue-feedback ' + cls; fb.textContent = text; void fb.offsetWidth; fb.classList.add('show');
}
function resetPlay(pack) {
  cuesTotal = pack.cues;
  $('combo').textContent = '🔥 Combo 0';
  $('wave').textContent = `0 / ${pack.cues}`;
  $('burnFill').style.height = '0%';
  $('pan').classList.remove('burnt', 'sizzle'); $('smoke').style.opacity = 0;
  for (const k in spices) spices[k].remove(); spices = {};
}

socket.on('tadka:start', ({ pack, leadMs }) => {
  show('play'); resetPlay(pack);
  const steps = ['3', '2', '1', 'GO! 🍳'];
  const each = leadMs / steps.length;
  steps.forEach((s, i) => setTimeout(() => { bigFeedback(s, 'fb-ok'); Sound.play(i < 3 ? 'countdown' : 'go'); }, i * each));
});

socket.on('tadka:cue', ({ id, spice, windowMs, index, total }) => {
  $('wave').textContent = `${index} / ${total}`;
  const el = document.createElement('div'); el.className = 'spice';
  el.innerHTML = `<span class="ring"></span><span>${spice}</span>`;
  el.style.transition = `top ${windowMs}ms linear, opacity .2s, transform .2s`;
  const ring = el.querySelector('.ring'); ring.style.transition = `transform ${windowMs}ms linear`;
  $('panStage').appendChild(el); spices[id] = el;
  requestAnimationFrame(() => { el.style.top = '60%'; ring.style.transform = 'scale(0.85)'; });
  Sound.play('tick');
});

socket.on('tadka:result', ({ id, burn, combo, quality }) => {
  const el = spices[id];
  if (el) { el.classList.add(quality === 'bad' ? 'miss' : 'land'); setTimeout(() => el.remove(), 260); delete spices[id]; }
  $('burnFill').style.height = `${Math.round(burn)}%`;
  const c = $('combo'); c.textContent = `🔥 Combo ${combo}`; c.classList.add('bump'); setTimeout(() => c.classList.remove('bump'), 130);
  const pan = $('pan');
  pan.classList.toggle('burnt', burn > 70);
  $('smoke').style.opacity = burn > 55 ? Math.min(1, (burn - 55) / 45) : 0;
  if (quality === 'perfect') { pan.classList.add('sizzle'); setTimeout(() => pan.classList.remove('sizzle'), 200); bigFeedback('Perfect! 🔥', 'fb-perfect'); Sound.play('combo'); }
  else if (quality === 'ok') { bigFeedback('Sizzling 👍', 'fb-ok'); Sound.play('reveal'); }
  else { bigFeedback('Burning! 😱', 'fb-bad'); Sound.play('warn'); }
});

// --- results ---
socket.on('game:over', ({ results, success, maxCombo }) => {
  show('results');
  for (const k in spices) spices[k].remove(); spices = {};
  $('resultTitle').innerHTML = success ? '<span class="title-gradient">TADKA SERVED! 🎉</span>' : '<span class="title-gradient">BURNT! 🔥</span>';
  $('bigResult').textContent = success ? `Perfectly cooked — best combo x${maxCombo} 🌶️` : `The pan caught fire… best combo x${maxCombo}`;
  const sb = $('scoreboard'); sb.innerHTML = '';
  results.forEach((p, i) => {
    const off = p.connected === false;
    const row = document.createElement('div'); row.className = 'sb-row' + (i === 0 ? ' winner' : '') + (off ? ' offline' : '');
    row.style.animationDelay = `${i * 0.1}s`;
    const rank = document.createElement('div'); rank.className = 'rank'; rank.textContent = i === 0 ? '👑' : '#' + (i + 1);
    const name = document.createElement('div'); name.className = 'sb-name'; name.textContent = p.name;
    const score = document.createElement('div'); score.className = 'sb-score'; score.textContent = (p.score || 0).toLocaleString();
    row.append(rank, avatarEl(p.avatar, off ? 'offline' : ''), name, score);
    sb.appendChild(row);
  });
  if (success) { Sound.play('fanfare'); confettiBurst(200); } else { Sound.play('error'); }
  window.ttrack?.('game_finished', { players: results.length });
});
$('playAgainBtn').onclick = () => socket.emit('host:playAgain');
socket.on('game:lobby', () => show('lobby'));
