import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), clue: $('screen-clue'), vote: $('screen-vote'), reveal: $('screen-reveal'), results: $('screen-results') };
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
let myId = null, myName = '', ready = false, joinedCode = null, amWolf = false;
socket.on('connect', () => { if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId }); });
const saved = (() => { try { return JSON.parse(localStorage.getItem('bhediya_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('bhediya_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  try { localStorage.setItem('tadka_session', JSON.stringify({ game: NS, code, playerId: id, name, at: Date.now() })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); socket.emit('bhediya:whoami'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- role / clue ---
socket.on('bhediya:role', ({ category, word, wolf, phase }) => {
  amWolf = !!wolf;
  if (phase !== 'clue') return; // vote/reveal screens are driven separately
  $('pCat').textContent = category || '';
  if (wolf) {
    $('pWord').textContent = '🐺 You are the BHEDIYA'; $('pWord').classList.add('wolf');
    $('pHint').textContent = "You don't know the word! Bluff a clue that fits the category — and don't get caught.";
  } else {
    $('pWord').textContent = word || ''; $('pWord').classList.remove('wolf');
    $('pHint').textContent = 'Give a one-word clue to prove you know it — but not so obvious the wolf can copy you.';
  }
  $('clueInput').value = ''; $('clueInput').disabled = false;
  $('clueSubmit').classList.remove('hidden'); $('clueSubmit').disabled = false;
  $('clueLocked').classList.add('hidden');
  show('clue');
});
$('clueSubmit').onclick = () => {
  const text = $('clueInput').value.trim();
  if (!text) return;
  socket.emit('bhediya:submitClue', { text }, (res) => {
    if (res?.ok) {
      $('clueInput').disabled = true; $('clueSubmit').classList.add('hidden');
      $('clueLocked').classList.remove('hidden'); Sound.play('join');
    }
  });
};

// --- vote ---
socket.on('bhediya:vote', ({ clues }) => {
  $('voteLocked').classList.add('hidden');
  const wrap = $('voteOpts'); wrap.innerHTML = '';
  clues.forEach((c) => {
    const b = document.createElement('button'); b.className = 'vote-opt';
    if (c.playerId === myId) { b.classList.add('mine'); b.disabled = true; }
    const av = document.createElement('div'); av.className = 'avatar'; av.textContent = c.avatar.emoji;
    av.style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${c.avatar.color})`;
    const box = document.createElement('div');
    box.innerHTML = `<div class="vo-clue">“${esc(c.clue)}”</div><div class="vo-name">${esc(c.name)}${c.playerId === myId ? ' (you)' : ''}</div>`;
    b.append(av, box);
    b.onclick = () => {
      if (b.disabled) return;
      socket.emit('bhediya:castVote', { playerId: c.playerId }, (res) => {
        if (res?.ok) { [...wrap.children].forEach((x) => { x.disabled = true; }); b.classList.add('picked'); $('voteLocked').classList.remove('hidden'); Sound.play('join'); }
      });
    };
    wrap.appendChild(b);
  });
  show('vote');
});

// --- reveal ---
socket.on('bhediya:reveal', ({ wolfId, wolfName, word, caught, players }) => {
  let emoji = '🐺', msg = '', score = '';
  if (myId === wolfId) {
    emoji = caught ? '😬' : '😎';
    msg = caught ? 'You got caught!' : 'You fooled them!';
    score = caught ? '' : '+300';
  } else {
    const me = players.find((p) => p.playerId === myId);
    const votedWolf = me && me.votedFor === wolfName;
    emoji = votedWolf ? '🎯' : '🙈';
    msg = `The wolf was ${wolfName} — the word was “${word}”`;
    score = votedWolf ? '+100' : '';
  }
  $('rEmoji').textContent = emoji; $('rMsg').textContent = msg; $('rScore').textContent = score;
  show('reveal');
  if (score) Sound.play('go');
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
