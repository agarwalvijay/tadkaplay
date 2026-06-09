import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), round: $('screen-round'), reveal: $('screen-reveal'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
const saved = (() => { try { return JSON.parse(localStorage.getItem('npac_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('npac_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  try { localStorage.setItem('tadka_session', JSON.stringify({ game: NS, code, playerId: id, name, at: Date.now() })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- round ---
let inputs = [], submitted = false, autoTimer = null;
function setAuto(seconds) { clearTimeout(autoTimer); autoTimer = setTimeout(() => doSubmit(true), Math.max(300, seconds * 1000 - 400)); }
function doSubmit(auto) {
  if (submitted) return;
  submitted = true; clearTimeout(autoTimer);
  socket.emit('npac:submit', { answers: inputs.map((i) => i.value) }, () => {});
  inputs.forEach((i) => { i.disabled = true; });
  $('submitBtn').classList.add('hidden');
  $('roundLocked').classList.remove('hidden');
  $('roundLocked').textContent = auto ? "⏱️ Time! Your answers are in." : '🔒 Locked in! Waiting for the others…';
  Sound.play('go');
}
socket.on('npac:round', ({ letter, categories, seconds }) => {
  submitted = false;
  $('plLetter').textContent = letter;
  const f = $('fields'); f.innerHTML = ''; inputs = [];
  categories.forEach((c) => {
    const wrap = document.createElement('div'); wrap.className = 'fld';
    const lab = document.createElement('label'); lab.textContent = c;
    const inp = document.createElement('input'); inp.maxLength = 40; inp.autocomplete = 'off'; inp.placeholder = `${letter}…`;
    wrap.append(lab, inp); f.appendChild(wrap); inputs.push(inp);
  });
  $('submitBtn').classList.remove('hidden'); $('roundLocked').classList.add('hidden');
  show('round'); setAuto(seconds);
});
$('submitBtn').onclick = () => doSubmit(false);
socket.on('npac:stopped', ({ seconds }) => { if (!submitted) setAuto(seconds); });

// --- reveal ---
socket.on('npac:reveal', ({ rows }) => {
  const me = rows.find((r) => r.playerId === myId);
  $('rMsg').textContent = me ? 'Pencils down!' : 'Round over!';
  $('rScore').textContent = me ? `+${me.roundTotal} this round` : '';
  show('reveal');
  if (me && me.roundTotal > 0) Sound.play('go');
});

// --- results ---
socket.on('game:over', ({ results }) => {
  const idx = results.findIndex((p) => p.id === myId); const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji; $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName; $('resultScore').textContent = (me.score || 0).toLocaleString();
  show('results');
});
socket.on('game:lobby', () => { ready = false; const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋"; show('wait'); });
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
