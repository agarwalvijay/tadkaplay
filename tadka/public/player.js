import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), play: $('screen-play'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };

// avatar picker
let avatar = randomAvatar();
function renderPicker() {
  const eg = $('emojiGrid'); eg.innerHTML = '';
  EMOJIS.forEach((e) => { const b = document.createElement('button'); b.textContent = e; if (e === avatar.emoji) b.classList.add('sel'); b.onclick = () => { avatar.emoji = e; renderPicker(); updatePreview(); }; eg.appendChild(b); });
  const cr = $('colorRow'); cr.innerHTML = '';
  COLORS.forEach((c) => { const b = document.createElement('button'); b.style.background = c; if (c === avatar.color) b.classList.add('sel'); b.onclick = () => { avatar.color = c; renderPicker(); updatePreview(); }; cr.appendChild(b); });
}
function updatePreview() { const p = $('avatarPreview'); p.textContent = avatar.emoji; p.style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`; }
renderPicker(); updatePreview();
$('randomName').onclick = () => { $('nameInput').value = randomName(); avatar = randomAvatar(); renderPicker(); updatePreview(); };
const params = new URLSearchParams(location.search);
if (params.get('room')) $('codeInput').value = params.get('room').toUpperCase();

// join + reconnect
let myId = null, myName = '', ready = false, joinedCode = null;
socket.on('connect', () => { if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId }); });
const saved = (() => { try { return JSON.parse(localStorage.getItem('tadka_player') || '{}'); } catch { return {}; } })();
// auto-rejoin after an accidental refresh (the play URL keeps ?room=CODE)
const reCode = (params.get('room') || '').toUpperCase();
if (reCode && saved.playerId) { myId = saved.playerId; myName = saved.name || ''; if (saved.avatar) avatar = saved.avatar; joinedCode = reCode; }
const showErr = (m) => { const e = $('joinError'); e.textContent = m; e.classList.remove('hidden'); };

$('joinBtn').onclick = () => {
  Sound.unlock();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) return showErr('Enter the 4-letter room code');
  myName = ($('nameInput').value.trim() || randomName()).slice(0, 16);
  socket.emit('player:join', { code, name: myName, avatar, playerId: saved.playerId });
};
socket.on('player:joinError', () => showErr('Room not found — check the code.'));
socket.on('player:joined', ({ id, code, name, avatar: av, spectator }) => {
  myId = id; myName = name; joinedCode = code;
  try { localStorage.setItem('tadka_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  try { localStorage.setItem('tadka_session', JSON.stringify({ game: NS, code, playerId: id, name, at: Date.now() })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- play ---
const pad = $('tapPad');
let cueId = null, windowTimer = null, tapped = false;
function dimPad() { pad.classList.remove('live'); $('tapLabel').textContent = 'WAIT'; $('tapSpice').textContent = '🍳'; cueId = null; }

socket.on('tadka:start', () => { show('play'); $('tapHead').textContent = 'Get ready… 🍳'; dimPad(); $('tapFb').textContent = ''; });

socket.on('tadka:cue', ({ id, spice, windowMs }) => {
  cueId = id; tapped = false;
  $('tapHead').textContent = 'TAP NOW!';
  $('tapSpice').textContent = spice; $('tapLabel').textContent = 'TAP!';
  pad.classList.remove('hit'); pad.classList.add('live');
  clearTimeout(windowTimer); windowTimer = setTimeout(() => { if (cueId === id) dimPad(); }, windowMs);
});

function doTap(e) {
  e.preventDefault();
  if (cueId === null || tapped) return;
  tapped = true;
  const id = cueId;
  pad.classList.add('hit'); pad.classList.remove('live');
  socket.emit('tadka:tap', { cueId: id }, (res) => {
    const fb = $('tapFb');
    if (res?.ok && res.timing === 'perfect') { fb.className = 'tap-fb perfect'; fb.textContent = 'Perfect! 🔥'; Sound.play('combo'); }
    else if (res?.ok) { fb.className = 'tap-fb good'; fb.textContent = 'Nice! 👍'; Sound.play('select'); }
    else { fb.className = 'tap-fb late'; fb.textContent = 'Too slow 😅'; }
    setTimeout(() => { if ($('tapFb').textContent) $('tapFb').textContent = ''; }, 600);
  });
}
pad.addEventListener('pointerdown', doTap);

socket.on('tadka:result', () => { $('tapHead').textContent = 'Wait for it…'; });

// --- results ---
socket.on('game:over', ({ results, success }) => {
  const idx = results.findIndex((p) => p.id === myId); const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji; $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName; $('resultScore').textContent = (me.score || 0).toLocaleString();
  show('results');
});
socket.on('game:lobby', () => { ready = false; const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋"; show('wait'); });
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
