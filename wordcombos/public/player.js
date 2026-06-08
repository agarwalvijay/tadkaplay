import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';
import { spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(12);
// Connect to this game's socket namespace, derived from the URL prefix
// (e.g. /wordcombos/play -> '/wordcombos'), so the game runs inside the hub.
const socket = io('/' + (location.pathname.split('/').filter(Boolean)[0] || ''));
const $ = (id) => document.getElementById(id);

const screens = {
  join: $('screen-join'),
  wait: $('screen-wait'),
  countdown: $('screen-countdown'),
  play: $('screen-play'),
  results: $('screen-results'),
};
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
}

$('muteBtn').addEventListener('click', () => {
  const m = Sound.toggleMute();
  $('muteBtn').textContent = m ? '🔇' : '🔊';
});

// ---------------------------------------------------------------------------
// Join screen
// ---------------------------------------------------------------------------
const state = {
  avatar: randomAvatar(),
  myId: null,
  size: 4,
  display: [],
  endsAt: 0,
  duration: 90,
  spectator: false,
};

// prefill room from URL
const params = new URLSearchParams(location.search);
if (params.get('room')) $('codeInput').value = params.get('room').toUpperCase();

// saved identity
try {
  const saved = JSON.parse(localStorage.getItem('wc_profile') || '{}');
  if (saved.name) $('nameInput').value = saved.name;
  if (saved.avatar) state.avatar = saved.avatar;
} catch {}
// no default name — leave the field empty (placeholder). If left blank at
// join, a random name is used (see joinBtn handler).

// build pickers
const emojiGrid = $('emojiGrid');
EMOJIS.forEach((e) => {
  const b = document.createElement('button');
  b.textContent = e;
  b.addEventListener('click', () => {
    state.avatar.emoji = e;
    syncAvatar();
    Sound.unlock(); Sound.play('select');
  });
  emojiGrid.appendChild(b);
});
const colorRow = $('colorRow');
COLORS.forEach((c) => {
  const b = document.createElement('button');
  b.style.background = c;
  b.addEventListener('click', () => {
    state.avatar.color = c;
    syncAvatar();
    Sound.unlock(); Sound.play('select');
  });
  colorRow.appendChild(b);
});

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}
function styleAvatar(el, av) {
  el.textContent = av.emoji;
  el.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`;
}
function syncAvatar() {
  styleAvatar($('avatarPreview'), state.avatar);
  [...emojiGrid.children].forEach((b) => b.classList.toggle('sel', b.textContent === state.avatar.emoji));
  [...colorRow.children].forEach((b) => b.classList.toggle('sel', b.style.background === toRGB(state.avatar.color)));
}
function toRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}
syncAvatar();

$('randomName').addEventListener('click', () => { $('nameInput').value = randomName(); Sound.play('select'); });

$('joinBtn').addEventListener('click', () => {
  Sound.unlock();
  const code = $('codeInput').value.toUpperCase().trim();
  const name = $('nameInput').value.trim() || randomName();
  if (code.length !== 4) { showJoinError('Enter the 4-letter room code'); return; }
  localStorage.setItem('wc_profile', JSON.stringify({ name, avatar: state.avatar }));
  const playerId = sessionStorage.getItem('wc_pid');
  socket.emit('player:join', { code, name, avatar: state.avatar, playerId });
});
function showJoinError(msg) {
  const el = $('joinError');
  el.textContent = msg; el.classList.remove('hidden');
  Sound.play('error');
}

// re-join automatically if the socket reconnects (e.g. after a screen lock)
socket.on('connect', () => {
  if (state.joinedCode) socket.emit('player:join', { code: state.joinedCode, name: state.myName, avatar: state.avatar, playerId: state.myId });
});
socket.on('player:joinError', () => showJoinError("Couldn't find that room. Check the code!"));

socket.on('player:joined', ({ id, code, name, avatar, state: gameState, spectator }) => {
  state.myId = id;
  state.joinedCode = code;
  state.myName = name;
  state.spectator = spectator;
  window.ttrack?.('player_joined');
  sessionStorage.setItem('wc_pid', id);
  styleAvatar($('waitAvatar'), avatar);
  $('waitName').textContent = name;
  styleAvatar($('resultAvatar'), avatar);
  $('resultName').textContent = name;
  $('spectatorNote').classList.toggle('hidden', !spectator);
  $('readyBtn').classList.toggle('hidden', spectator);
  if (gameState === 'lobby') { show('wait'); Sound.play('join'); }
});

// ready toggle
let ready = false;
$('readyBtn').addEventListener('click', () => {
  ready = !ready;
  socket.emit('player:setReady', { ready });
  const b = $('readyBtn');
  b.classList.toggle('is-ready', ready);
  b.textContent = ready ? "Ready! (tap to cancel) ✓" : "I'm Ready! ✋";
  Sound.play(ready ? 'success' : 'select');
});

socket.on('room:players', ({ players, state: gameState }) => {
  const mini = $('lobbyMini');
  mini.innerHTML = '';
  players.forEach((p) => {
    const d = document.createElement('div');
    d.className = 'avatar' + (p.connected ? '' : ' offline');
    styleAvatar(d, p.avatar);
    mini.appendChild(d);
  });
});

// ---------------------------------------------------------------------------
// Countdown
// ---------------------------------------------------------------------------
socket.on('game:countdown', ({ seconds }) => {
  if (state.spectator) return;
  show('countdown');
  let n = seconds;
  const el = $('pCountNumber');
  const step = () => {
    el.textContent = n > 0 ? n : 'GO!';
    el.classList.remove('count-anim'); void el.offsetWidth; el.classList.add('count-anim');
    Sound.play(n > 0 ? 'countdown' : 'go');
    n--;
    if (n >= -1) setTimeout(step, 1000);
  };
  step();
});

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------
let myScore = 0;
let myWords = 0;
let found = new Set();
let timerInt = null;

socket.on('game:start', (data) => {
  state.size = data.size;
  state.display = data.display;
  state.endsAt = data.endsAt;
  state.duration = data.duration;
  state.spectator = !!data.spectator;
  myScore = 0; myWords = 0; found = new Set();
  $('hudScore').textContent = '0';
  $('hudWords').textContent = '0';
  buildBoard();
  show('play');
  startTimer();
});

function buildBoard() {
  const board = $('board');
  board.innerHTML = '';
  state.display.forEach((ch, i) => {
    const t = document.createElement('div');
    t.className = 'tile';
    t.dataset.idx = i;
    t.textContent = ch;
    board.appendChild(t);
  });
}

function startTimer() {
  clearInterval(timerInt);
  const el = $('hudTimer');
  const update = () => {
    const left = Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000));
    el.textContent = left;
    el.classList.toggle('danger', left <= 10 && left > 0);
    if (left <= 0) { clearInterval(timerInt); endLocalPlay(); }
  };
  update();
  timerInt = setInterval(update, 200);
}
function endLocalPlay() {
  // The server's game:over drives the results screen; this just freezes input.
  selecting = false;
  clearSelection();
}

// ---- selection mechanics ----
let selecting = false;
let path = [];
const board = $('board');
const trail = $('trail');

function tileAt(x, y) {
  const el = document.elementFromPoint(x, y);
  if (el && el.classList.contains('tile')) return el;
  return null;
}
function idxOf(tile) { return Number(tile.dataset.idx); }
function rc(i) { return [Math.floor(i / state.size), i % state.size]; }
function adjacent(a, b) {
  const [ra, ca] = rc(a), [rb, cb] = rc(b);
  return Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1 && a !== b;
}

function addTile(tile) {
  const idx = idxOf(tile);
  if (path.length && path[path.length - 1] === idx) return;
  // backtrack: stepping onto the previous tile removes the last
  if (path.length >= 2 && path[path.length - 2] === idx) {
    const removed = path.pop();
    document.querySelector(`.tile[data-idx="${removed}"]`)?.classList.remove('sel');
    updateWord();
    drawTrail();
    Sound.play('select');
    return;
  }
  if (path.includes(idx)) return;
  if (path.length && !adjacent(path[path.length - 1], idx)) return;
  path.push(idx);
  tile.classList.add('sel');
  Sound.play('tile', path.length);
  navigator.vibrate?.(8);
  updateWord();
  drawTrail();
}

function currentWordStr() {
  return path.map((i) => state.display[i]).join('').toUpperCase();
}
function updateWord() {
  const w = currentWordStr();
  const el = $('currentWord');
  el.textContent = w || ' ';
  el.classList.toggle('valid', w.length >= 3);
}

function drawTrail() {
  while (trail.firstChild) trail.removeChild(trail.firstChild);
  if (path.length < 1) return;
  const brect = board.getBoundingClientRect();
  trail.setAttribute('viewBox', `0 0 ${brect.width} ${brect.height}`);
  const pts = path.map((i) => {
    const t = document.querySelector(`.tile[data-idx="${i}"]`).getBoundingClientRect();
    return [t.left - brect.left + t.width / 2, t.top - brect.top + t.height / 2];
  });
  if (pts.length >= 2) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', pts.map((p) => p.join(',')).join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'rgba(255,210,63,0.85)');
    line.setAttribute('stroke-width', '12');
    line.setAttribute('stroke-linejoin', 'round');
    line.setAttribute('stroke-linecap', 'round');
    trail.appendChild(line);
  }
  for (const [x, y] of pts) {
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '7');
    dot.setAttribute('fill', '#06d6a0');
    trail.appendChild(dot);
  }
}

function clearSelection() {
  path.forEach((i) => document.querySelector(`.tile[data-idx="${i}"]`)?.classList.remove('sel'));
  path = [];
  updateWord();
  while (trail.firstChild) trail.removeChild(trail.firstChild);
}

function submit() {
  const word = currentWordStr();
  const submitPath = path.slice();
  if (submitPath.length < 3) { clearSelection(); return; }
  socket.emit('player:submitWord', { path: submitPath }, (res) => handleResult(res, submitPath, word));
  clearSelection();
}

function handleResult(res, submitPath, word) {
  const toast = $('toast');
  if (res?.ok) {
    myScore = res.total;
    myWords += 1;
    found.add(res.word);
    $('hudScore').textContent = myScore.toLocaleString();
    $('hudWords').textContent = myWords;
    flashTiles(submitPath, 'flash-good');
    Sound.play('success', res.word.length);
    let msg = `+${res.points} ${res.word.toUpperCase()}`;
    if (res.combo >= 1) {
      msg += `  🔥x${res.multiplier}`;
      showCombo(res.combo, res.multiplier);
      Sound.play('combo', res.combo);
    }
    setToast(msg, 'good');
    navigator.vibrate?.(30);
  } else {
    flashTiles(submitPath, 'flash-bad');
    const reasons = {
      notword: 'Not a word 🤔',
      dupe: 'Already found! ✋',
      tooshort: 'Too short — 3+ letters',
      badpath: 'Letters must connect',
      notplaying: '',
      spectator: '',
    };
    const m = reasons[res?.reason] ?? 'Nope';
    if (m) setToast(m, 'bad');
    Sound.play(res?.reason === 'dupe' ? 'dupe' : 'error');
    navigator.vibrate?.([20, 40, 20]);
  }
}

function flashTiles(idxs, cls) {
  idxs.forEach((i) => {
    const t = document.querySelector(`.tile[data-idx="${i}"]`);
    if (!t) return;
    t.classList.remove('flash-good', 'flash-bad'); void t.offsetWidth;
    t.classList.add(cls);
    setTimeout(() => t.classList.remove(cls), 600);
  });
}

let toastTimer = null;
function setToast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

let comboTimer = null;
function showCombo(combo, mult) {
  const b = $('comboBadge');
  b.textContent = `COMBO x${mult}`;
  b.classList.remove('hidden');
  b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(comboTimer);
  comboTimer = setTimeout(() => b.classList.add('hidden'), 1600);
}

// pointer events on the board
function onDown(e) {
  if (state.spectator) return;
  const t = tileAt(e.clientX, e.clientY);
  if (!t) return;
  e.preventDefault();
  selecting = true;
  clearSelection();
  addTile(t);
}
function onMove(e) {
  if (!selecting) return;
  e.preventDefault();
  const point = e.touches ? e.touches[0] : e;
  const t = tileAt(point.clientX, point.clientY);
  if (t) addTile(t);
}
function onUp(e) {
  if (!selecting) return;
  selecting = false;
  submit();
}
board.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove, { passive: false });
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', () => { selecting = false; clearSelection(); });
window.addEventListener('resize', () => { if (path.length) drawTrail(); });

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
socket.on('game:over', ({ results }) => {
  clearInterval(timerInt);
  const me = results.find((r) => r.id === state.myId);
  show('results');
  if (!me) {
    $('rankBig').textContent = '👀';
    $('resultScore').textContent = '';
    $('resultSub').textContent = 'You watched this round — get ready for the next!';
    $('myWords').innerHTML = '';
    return;
  }
  $('rankBig').textContent = `#${me.rank}`;
  $('resultScore').textContent = me.score.toLocaleString();
  const place = me.rank === 1 ? '🏆 You WON!' : me.rank <= 3 ? '🎉 Podium finish!' : 'Nice hunting!';
  $('resultSub').textContent = `${place} ${me.wordCount} words found.`;
  const wrap = $('myWords');
  wrap.innerHTML = '';
  me.words.forEach((w) => {
    const c = document.createElement('div');
    c.className = 'wchip' + (w.unique ? ' uniq' : '');
    c.innerHTML = `${w.word.toUpperCase()} <b>+${w.points}</b>`;
    wrap.appendChild(c);
  });
  Sound.play(me.rank === 1 ? 'fanfare' : 'reveal');
});

socket.on('game:lobby', () => {
  ready = false;
  $('readyBtn').classList.remove('is-ready');
  $('readyBtn').textContent = "I'm Ready! ✋";
  state.spectator = false;
  $('spectatorNote').classList.add('hidden');
  $('readyBtn').classList.remove('hidden');
  show('wait');
});

socket.on('host:left', () => {
  setToast('Host left the game', 'bad');
  setTimeout(() => location.reload(), 1500);
});
