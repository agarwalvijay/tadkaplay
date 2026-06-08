import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';
import { spawnBgLetters } from '/shared/fx.js';

spawnBgLetters(10);
const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);

const $ = (id) => document.getElementById(id);
const screens = {
  join: $('screen-join'), wait: $('screen-wait'), lie: $('screen-lie'),
  vote: $('screen-vote'), reveal: $('screen-reveal'), results: $('screen-results'),
};
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const norm = (s) => String(s).toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// --- avatar picker -------------------------------------------------------
let avatar = randomAvatar();
function renderPicker() {
  const eg = $('emojiGrid'); eg.innerHTML = '';
  EMOJIS.forEach((e) => {
    const b = document.createElement('button'); b.textContent = e;
    if (e === avatar.emoji) b.classList.add('sel');
    b.onclick = () => { avatar.emoji = e; renderPicker(); updatePreview(); };
    eg.appendChild(b);
  });
  const cr = $('colorRow'); cr.innerHTML = '';
  COLORS.forEach((c) => {
    const b = document.createElement('button'); b.style.background = c;
    if (c === avatar.color) b.classList.add('sel');
    b.onclick = () => { avatar.color = c; renderPicker(); updatePreview(); };
    cr.appendChild(b);
  });
}
function updatePreview() {
  const p = $('avatarPreview');
  p.textContent = avatar.emoji;
  p.style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
}
renderPicker(); updatePreview();
$('nameInput').value = randomName();
$('randomName').onclick = () => { $('nameInput').value = randomName(); avatar = randomAvatar(); renderPicker(); updatePreview(); };

const params = new URLSearchParams(location.search);
if (params.get('room')) $('codeInput').value = params.get('room').toUpperCase();

// --- join ----------------------------------------------------------------
let myId = null, myName = '', ready = false;
let myLie = '', myVoteIdx = null, iKnewIt = false;

const saved = (() => { try { return JSON.parse(localStorage.getItem('bluff_player') || '{}'); } catch { return {}; } })();

function showErr(m) { const e = $('joinError'); e.textContent = m; e.classList.remove('hidden'); }

$('joinBtn').onclick = () => {
  Sound.unlock();
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) return showErr('Enter the 4-letter room code');
  myName = ($('nameInput').value || 'Player').slice(0, 16);
  socket.emit('player:join', { code, name: myName, avatar, playerId: saved.playerId });
};

socket.on('player:joinError', () => showErr('Room not found — check the code.'));
socket.on('player:joined', ({ id, name, avatar: av, spectator }) => {
  myId = id; myName = name;
  try { localStorage.setItem('bluff_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  $('waitAvatar').textContent = av.emoji;
  $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name;
  $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait');
  window.ttrack?.('player_joined');
});

$('readyBtn').onclick = () => {
  ready = !ready;
  socket.emit('player:setReady', { ready });
  const b = $('readyBtn');
  b.classList.toggle('is-ready', ready);
  b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋";
};

// --- lie phase -----------------------------------------------------------
socket.on('bluff:lie', ({ q }) => {
  myLie = ''; myVoteIdx = null; iKnewIt = false;
  $('lieQ').textContent = q;
  $('lieInput').value = ''; $('lieInput').disabled = false;
  $('lieSubmit').classList.remove('hidden'); $('lieSubmit').disabled = false;
  $('lieLocked').classList.add('hidden');
  show('lie');
});
$('lieSubmit').onclick = () => {
  const text = $('lieInput').value.trim();
  if (!text) return;
  myLie = text;
  socket.emit('bluff:submitLie', { text }, (res) => {
    if (res?.ok) { iKnewIt = !!res.knewIt; lockLie(); }
  });
};
function lockLie() {
  $('lieInput').disabled = true;
  $('lieSubmit').classList.add('hidden');
  $('lieLocked').classList.remove('hidden');
  Sound.play('join');
}

// --- vote phase ----------------------------------------------------------
socket.on('bluff:vote', ({ q, options }) => {
  $('voteQ').textContent = q;
  $('voteLocked').classList.add('hidden');
  const wrap = $('voteOpts'); wrap.innerHTML = '';
  options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'vote-opt';
    const mine = myLie && norm(o.text) === norm(myLie);
    if (mine) { b.classList.add('mine'); b.disabled = true; }
    b.innerHTML = `<span class="letter">${String.fromCharCode(65 + i)}</span><span>${esc(o.text)}</span>`;
    b.onclick = () => {
      if (b.disabled) return;
      socket.emit('bluff:submitVote', { optionId: o.id }, (res) => {
        if (res?.ok) { myVoteIdx = i; lockVote(b); }
      });
    };
    wrap.appendChild(b);
  });
  show('vote');
});
function lockVote(picked) {
  [...$('voteOpts').children].forEach((c) => { c.disabled = true; });
  picked.classList.add('picked');
  $('voteLocked').classList.remove('hidden');
  Sound.play('join');
}

// --- reveal --------------------------------------------------------------
socket.on('bluff:reveal', ({ answer, options }) => {
  $('revealAnswer').textContent = answer;
  let pts = 0; const lines = [];
  if (iKnewIt) { pts += 1000; lines.push('🧠 You knew the truth!'); }
  else if (myVoteIdx != null && options[myVoteIdx]?.truth) { pts += 1000; lines.push('🎯 You found the truth!'); }
  else if (myVoteIdx != null) { lines.push('🙈 You got bluffed!'); }
  const myOpt = options.find((o) => !o.truth && myLie && norm(o.text) === norm(myLie));
  const fooled = myOpt?.voters.length || 0;
  if (fooled > 0) { pts += fooled * 500; lines.push(`😈 You fooled ${fooled} ${fooled === 1 ? 'player' : 'players'}!`); }
  $('revealResult').innerHTML = lines.length ? lines.join('<br>') : '—';
  $('revealScore').textContent = pts > 0 ? `+${pts.toLocaleString()}` : '';
  show('reveal');
  if (pts > 0) Sound.play('go');
});

// --- results -------------------------------------------------------------
socket.on('game:over', ({ results }) => {
  const idx = results.findIndex((p) => p.id === myId);
  const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji;
  $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName;
  $('resultScore').textContent = (me.score || 0).toLocaleString();
  show('results');
});

socket.on('game:lobby', () => {
  ready = false;
  const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋";
  show('wait');
});
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
