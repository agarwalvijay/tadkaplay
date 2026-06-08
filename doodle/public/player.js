import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';
import { createBoard } from '/shared/doodle-canvas.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = {
  join: $('screen-join'), wait: $('screen-wait'), play: $('screen-play'),
  reveal: $('screen-reveal'), results: $('screen-results'),
};
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };

// --- avatar picker -------------------------------------------------------
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

// --- join ----------------------------------------------------------------
let myId = null, myName = '', ready = false, joinedCode = null;
socket.on('connect', () => {
  if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId });
});
const saved = (() => { try { return JSON.parse(localStorage.getItem('doodle_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('doodle_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait');
  window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => {
  ready = !ready; socket.emit('player:setReady', { ready });
  const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋";
};

// --- board ---------------------------------------------------------------
const board = createBoard($('board'), { drawable: false, onSegment: (seg) => socket.emit('doodle:stroke', seg) });

// swatches for the drawer
const PALETTE = ['#1a0b2e', '#ff3b30', '#ff8c42', '#ffd23f', '#06d6a0', '#4cc9f0', '#9b5de5', '#ffffff'];
let curColor = PALETTE[0];
function renderSwatches() {
  const wrap = $('swatches'); wrap.innerHTML = '';
  PALETTE.forEach((c) => {
    const b = document.createElement('button'); b.style.background = c; if (c === curColor) b.classList.add('sel');
    b.onclick = () => { curColor = c; board.setColor(c); [...wrap.children].forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); };
    wrap.appendChild(b);
  });
}
renderSwatches();
$('clearBtn').onclick = () => { board.clear(); socket.emit('doodle:clear'); };

// --- round ---------------------------------------------------------------
let amDrawer = false;
socket.on('doodle:round', ({ drawerId, drawerName, pattern }) => {
  amDrawer = (myId === drawerId);
  $('gotit').classList.add('hidden');
  $('tools').classList.toggle('hidden', !amDrawer);
  $('guessRow').classList.toggle('hidden', amDrawer);
  $('pattern').classList.toggle('hidden', amDrawer);
  if (amDrawer) {
    $('roleLine').textContent = '✏️ You are the artist!';
    $('pattern').textContent = '';
  } else {
    $('roleLine').textContent = `🎨 ${drawerName} is drawing`;
    $('pattern').textContent = pattern;
    $('guessInput').value = ''; $('guessInput').disabled = false; $('guessBtn').disabled = false;
  }
  show('play');
  // size the canvas only after it's visible, otherwise it fits to 0×0 and
  // your own strokes draw onto an invisible bitmap
  board.setDrawable(amDrawer); board.setColor(curColor); board.fit(); board.clear();
});
socket.on('doodle:word', ({ word }) => { if (amDrawer) $('roleLine').textContent = `✏️ Draw: ${word}`; });
socket.on('doodle:stroke', (seg) => board.drawSegment(seg));
socket.on('doodle:clear', () => board.clear());

function submitGuess() {
  const text = $('guessInput').value.trim();
  if (!text) return;
  socket.emit('doodle:guess', { text }, (res) => {
    if (res?.correct) {
      $('gotit').textContent = `🎉 You got it! +${res.points}`;
      $('gotit').classList.remove('hidden');
      $('guessInput').disabled = true; $('guessBtn').disabled = true;
      Sound.play('go');
    } else {
      $('guessInput').value = '';
    }
  });
}
$('guessBtn').onclick = submitGuess;
$('guessInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuess(); });

// --- reveal / results ----------------------------------------------------
socket.on('doodle:reveal', ({ word }) => {
  $('revealAnswer').textContent = word;
  $('revealScore').textContent = '';
  show('reveal');
});
socket.on('game:over', ({ results }) => {
  const idx = results.findIndex((p) => p.id === myId);
  const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji; $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName; $('resultScore').textContent = (me.score || 0).toLocaleString();
  show('results');
});
socket.on('game:lobby', () => {
  ready = false; const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋";
  show('wait');
});
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
