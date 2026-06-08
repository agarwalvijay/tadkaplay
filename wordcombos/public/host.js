import { Sound } from './sounds.js';
import { confettiBurst, spawnBgLetters } from './fx.js';

spawnBgLetters(20);
// Connect to this game's socket namespace, derived from the URL prefix
// (e.g. /wordcombos/host -> '/wordcombos'), so the game runs inside the hub.
const socket = io('/' + (location.pathname.split('/').filter(Boolean)[0] || ''));

const $ = (id) => document.getElementById(id);
const screens = {
  lobby: $('screen-lobby'),
  countdown: $('screen-countdown'),
  play: $('screen-play'),
  results: $('screen-results'),
};
function show(name) {
  for (const [k, el] of Object.entries(screens)) el.classList.toggle('hidden', k !== name);
}

// ---- mute ----
$('muteBtn').addEventListener('click', () => {
  const m = Sound.toggleMute();
  $('muteBtn').textContent = m ? '🔇' : '🔊';
});

// ---- create / start ----
$('createBtn').addEventListener('click', () => {
  Sound.unlock();
  socket.emit('host:create');
  $('preStart').classList.add('hidden');
  $('lobbyBody').classList.remove('hidden');
});

let roundSeconds = 90;
socket.on('host:created', ({ code, joinUrl, qr, roundSeconds: rs }) => {
  roundSeconds = rs;
  $('qrImg').src = qr;
  $('roomCode').textContent = code;
  $('joinUrl').textContent = joinUrl.replace(/^https?:\/\//, '');
});

$('startGameBtn').addEventListener('click', () => {
  Sound.play('go');
  socket.emit('host:start');
});
$('playAgainBtn').addEventListener('click', () => socket.emit('host:playAgain'));

// ---- helpers ----
function avatarEl(av, sizeClass = '') {
  const d = document.createElement('div');
  d.className = `avatar ${sizeClass}`;
  d.style.background = `radial-gradient(circle at 30% 25%, ${shade(av.color, 30)}, ${av.color})`;
  d.textContent = av.emoji;
  return d;
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + pct, g = ((n >> 8) & 255) + pct, b = (n & 255) + pct;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

// ---- lobby ----
let lastPlayerIds = new Set();
socket.on('room:players', ({ players, state }) => {
  if (state === 'lobby') renderLobby(players);
});
function renderLobby(players) {
  const grid = $('lobbyPlayers');
  $('playerCount').textContent = players.length;
  $('emptyHint').classList.toggle('hidden', players.length > 0);
  $('startGameBtn').disabled = players.length === 0;

  grid.innerHTML = '';
  for (const p of players) {
    if (!lastPlayerIds.has(p.id)) Sound.play('join');
    const card = document.createElement('div');
    card.className = 'player-card' + (p.ready ? ' ready' : '');
    const av = avatarEl(p.avatar);
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;
    const status = document.createElement('div');
    status.className = 'pstatus';
    status.textContent = p.ready ? '✓ Ready' : 'joined';
    card.append(av, name, status);
    grid.appendChild(card);
  }
  lastPlayerIds = new Set(players.map((p) => p.id));
}

// ---- countdown ----
socket.on('game:countdown', ({ seconds }) => {
  show('countdown');
  let n = seconds;
  const el = $('countNumber');
  const tickOne = () => {
    el.textContent = n > 0 ? n : 'GO!';
    el.classList.remove('count-anim');
    void el.offsetWidth;
    el.classList.add('count-anim');
    Sound.play(n > 0 ? 'countdown' : 'go');
    n--;
    if (n >= -1) setTimeout(tickOne, 1000);
  };
  tickOne();
});

// ---- play ----
let endsAt = 0;
let timerInt = null;
let possibleCount = 0;
socket.on('game:start', ({ display, endsAt: e, duration, possibleCount: pc }) => {
  show('play');
  endsAt = e;
  roundSeconds = duration;
  possibleCount = pc;
  $('possiblePill').textContent = `${pc} possible words 🔍`;
  renderGridPreview(display);
  startTimer();
  $('wordFeed').innerHTML = '';
});
function renderGridPreview(display) {
  const g = $('gridPreview');
  g.innerHTML = '';
  for (const ch of display) {
    const c = document.createElement('div');
    c.className = 'cell';
    c.textContent = ch;
    g.appendChild(c);
  }
}
function startTimer() {
  clearInterval(timerInt);
  const ring = $('ringFg');
  const wrap = ring.closest('.timer-wrap');
  const C = 2 * Math.PI * 52;
  ring.style.strokeDasharray = C;
  let lastWhole = -1;
  const update = () => {
    const left = Math.max(0, (endsAt - Date.now()) / 1000);
    const frac = left / roundSeconds;
    ring.style.strokeDashoffset = C * (1 - frac);
    const whole = Math.ceil(left);
    $('timerText').textContent = whole;
    wrap.classList.toggle('danger', left <= 10);
    if (whole !== lastWhole && left <= 10 && left > 0) Sound.play('warn');
    lastWhole = whole;
    if (left <= 0) clearInterval(timerInt);
  };
  update();
  timerInt = setInterval(update, 100);
}

// live leaderboard
let prevScores = new Map();
socket.on('leaderboard:update', ({ players }) => {
  if (screens.play.classList.contains('hidden')) return;
  renderLiveBoard(players);
});
function renderLiveBoard(players) {
  const board = $('liveBoard');
  board.innerHTML = '';
  players.slice(0, 8).forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (i === 0 && p.score > 0 ? ' leader' : '');
    const prev = prevScores.get(p.id) ?? 0;
    if (p.score > prev) {
      row.classList.add('bump');
      pushFeed(p);
    }
    prevScores.set(p.id, p.score);
    row.innerHTML = `<div class="rank">${i + 1}</div>`;
    row.appendChild(avatarEl(p.avatar));
    const name = document.createElement('div');
    name.className = 'lb-name';
    name.textContent = p.name;
    const words = document.createElement('div');
    words.className = 'lb-words';
    words.textContent = `${p.wordCount} words`;
    const score = document.createElement('div');
    score.className = 'lb-score';
    score.textContent = p.score.toLocaleString();
    row.append(name, words, score);
    board.appendChild(row);
  });
}
function pushFeed(p) {
  const feed = $('wordFeed');
  const chip = document.createElement('div');
  chip.className = 'feed-chip';
  chip.innerHTML = `${p.avatar.emoji} <b>${p.name}</b> scored!`;
  feed.appendChild(chip);
  Sound.play('tick');
  setTimeout(() => chip.remove(), 2600);
  while (feed.children.length > 5) feed.firstChild.remove();
}

// ---- results ----
socket.on('game:over', ({ results, possibleCount, bestPossible, awards }) => {
  clearInterval(timerInt);
  show('results');
  renderPodium(results);
  renderAwards(awards, bestPossible);
  $('gridFact').innerHTML = results.length
    ? `Players found their words out of <b>${possibleCount}</b> possible. ` +
      (bestPossible ? `The grid's best hidden word was <b>${bestPossible.toUpperCase()}</b>.` : '')
    : 'No players this round.';
  Sound.play('drumroll');
  setTimeout(() => { Sound.play('fanfare'); confettiBurst(180); }, 1100);
});

function renderPodium(results) {
  const podium = $('podium');
  podium.innerHTML = '';
  const order = [1, 0, 2]; // visually: 2nd, 1st, 3rd
  const top3 = results.slice(0, 3);
  for (const slot of order) {
    const p = top3[slot];
    if (!p) continue;
    const col = document.createElement('div');
    col.className = `podium-col p${p.rank}`;
    col.style.animationDelay = `${slot * 0.25}s`;
    if (p.rank === 1) {
      const crown = document.createElement('div');
      crown.className = 'crown';
      crown.textContent = '👑';
      col.appendChild(crown);
    }
    col.appendChild(avatarEl(p.avatar));
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;
    const score = document.createElement('div');
    score.className = 'pscore';
    score.textContent = p.score.toLocaleString();
    const wc = document.createElement('div');
    wc.style.opacity = '0.7';
    wc.textContent = `${p.wordCount} words`;
    const base = document.createElement('div');
    base.className = 'podium-base';
    base.textContent = p.rank;
    col.append(name, score, wc, base);
    podium.appendChild(col);
  }

  // ranks 4+ go into a compact list between the podium and the awards.
  document.querySelectorAll('.rest-board').forEach((e) => e.remove());
  if (results.length > 3) {
    const rest = document.createElement('div');
    rest.className = 'rest-board';
    results.slice(3).forEach((p) => {
      const row = document.createElement('div');
      row.className = 'lb-row';
      row.innerHTML = `<div class="rank">${p.rank}</div>`;
      row.appendChild(avatarEl(p.avatar));
      const name = document.createElement('div');
      name.className = 'lb-name';
      name.textContent = p.name;
      const words = document.createElement('div');
      words.className = 'lb-words';
      words.textContent = `${p.wordCount} words`;
      const score = document.createElement('div');
      score.className = 'lb-score';
      score.textContent = p.score.toLocaleString();
      row.append(name, words, score);
      rest.appendChild(row);
    });
    $('awards').before(rest);
  }
}

function renderAwards(awards, bestPossible) {
  const wrap = $('awards');
  wrap.innerHTML = '';
  const items = [];
  if (awards.bestWord) items.push(['💎', 'Top Word', awards.bestWord.word, awards.bestWord]);
  if (awards.longestWord) items.push(['📏', 'Longest Word', awards.longestWord.word, awards.longestWord]);
  items.forEach(([emoji, label, word, who], i) => {
    const a = document.createElement('div');
    a.className = 'award';
    a.style.animationDelay = `${1.3 + i * 0.2}s`;
    a.innerHTML = `<div class="a-emoji">${emoji}</div><div>
      <div class="a-label">${label}</div>
      <div class="a-word">${word}</div>
      <div class="a-by">${who.avatar.emoji} ${who.name}</div></div>`;
    wrap.appendChild(a);
  });
}

socket.on('game:lobby', () => {
  show('lobby');
  prevScores = new Map();
  // remove any leftover rest-board
  document.querySelectorAll('.rest-board').forEach((e) => e.remove());
});

socket.on('disconnect', () => {});
