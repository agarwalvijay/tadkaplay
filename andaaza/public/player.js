import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), play: $('screen-play'), reveal: $('screen-reveal'), results: $('screen-results') };
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
let amClueGiver = false, myGuess = 50;
socket.on('connect', () => { if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId }); });
const saved = (() => { try { return JSON.parse(localStorage.getItem('andaaza_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('andaaza_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  try { localStorage.setItem('tadka_session', JSON.stringify({ game: NS, code, playerId: id, name, at: Date.now() })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

function setEnds(spectrum) { $('endLeft').textContent = spectrum.left; $('endRight').textContent = spectrum.right; }

// --- round (clue phase) ---
socket.on('andaaza:round', ({ clueGiverId, clueGiverName, spectrum }) => {
  amClueGiver = (myId === clueGiverId);
  setEnds(spectrum);
  $('clueBox').classList.add('hidden');
  $('tgt').classList.add('hidden');
  $('slider').classList.add('hidden');
  $('guessSubmit').classList.add('hidden');
  $('locked').classList.add('hidden');
  if (amClueGiver) {
    $('role').textContent = '🔮 You give the clue!';
    $('clueInput').classList.remove('hidden');
    $('clueText').value = ''; $('clueText').disabled = false; $('clueSubmit').disabled = false;
  } else {
    $('role').textContent = `🔮 ${clueGiverName} is giving a clue…`;
    $('clueInput').classList.add('hidden');
  }
  show('play');
});
socket.on('andaaza:target', ({ target }) => {
  if (!amClueGiver) return;
  const t = $('tgt'); t.style.left = `${target}%`; t.classList.remove('hidden');
});

$('clueSubmit').onclick = () => {
  const text = $('clueText').value.trim();
  if (!text) return;
  socket.emit('andaaza:clue', { text }, (res) => {
    if (res?.ok) {
      $('clueText').disabled = true; $('clueSubmit').disabled = true;
      $('clueInput').classList.add('hidden');
      $('role').textContent = '✅ Clue sent — waiting for guesses…';
      $('locked').classList.remove('hidden'); $('locked').textContent = `Your clue: “${text}”`;
      Sound.play('join');
    }
  });
};

// --- guess phase ---
socket.on('andaaza:guess', ({ clue, spectrum }) => {
  show('play'); // ensure a refresh mid-guess lands back in the game
  setEnds(spectrum);
  if (amClueGiver) {
    $('role').textContent = '⏳ Everyone is guessing…';
    return;
  }
  $('role').textContent = 'Where does it land?';
  $('clueBox').textContent = `“${clue}”`; $('clueBox').classList.remove('hidden');
  const sl = $('slider'); sl.classList.remove('hidden'); sl.value = 50; myGuess = 50; sl.disabled = false;
  sl.oninput = () => { myGuess = Number(sl.value); };
  $('guessSubmit').classList.remove('hidden'); $('guessSubmit').disabled = false;
  $('locked').classList.add('hidden');
});
$('guessSubmit').onclick = () => {
  socket.emit('andaaza:guess', { value: myGuess }, (res) => {
    if (res?.ok) {
      $('slider').disabled = true; $('guessSubmit').classList.add('hidden');
      $('locked').classList.remove('hidden'); $('locked').textContent = '🔒 Guess locked in!';
      Sound.play('join');
    }
  });
};

// --- reveal ---
socket.on('andaaza:reveal', ({ target, guesses, clueGiver }) => {
  let msg = `The bullseye was at ${target}.`;
  let scoreTxt = '';
  if (amClueGiver) { msg = 'Your clue is in!'; scoreTxt = clueGiver.points ? `+${clueGiver.points}` : ''; }
  else {
    const mine = guesses.find((g) => g.name === myName && g.value === myGuess) || guesses.find((g) => g.name === myName);
    if (mine) scoreTxt = mine.points ? `+${mine.points}` : '0';
  }
  $('revealMsg').textContent = msg;
  $('revealScore').textContent = scoreTxt;
  show('reveal');
  if (scoreTxt && scoreTxt !== '0') Sound.play('go');
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
