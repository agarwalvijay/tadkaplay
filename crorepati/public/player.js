import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), play: $('screen-play'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rupees = (n) => '₹' + n.toLocaleString('en-IN');

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

let myId = null, myName = '', ready = false, myChoice = null, joinedCode = null;
socket.on('connect', () => {
  if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId });
});
const saved = (() => { try { return JSON.parse(localStorage.getItem('kbc_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('kbc_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- question ---
let optBtns = [];
socket.on('kbc:question', ({ q, options, value }) => {
  myChoice = null;
  $('value').textContent = rupees(value);
  $('q').textContent = q;
  $('locked').classList.add('hidden');
  $('result').classList.add('hidden'); $('result').className = 'kbc-result hidden';
  const wrap = $('opts'); wrap.innerHTML = ''; optBtns = [];
  options.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'kbc-opt';
    b.innerHTML = `<span class="letter">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span>`;
    b.onclick = () => {
      if (myChoice !== null) return;
      myChoice = i;
      socket.emit('kbc:answer', { choice: i }, (res) => {
        if (res?.ok) {
          optBtns.forEach((x) => { x.disabled = true; });
          b.classList.add('picked');
          $('locked').classList.remove('hidden');
          Sound.play('join');
        } else { myChoice = null; }
      });
    };
    wrap.appendChild(b); optBtns.push(b);
  });
  show('play');
});

socket.on('kbc:reveal', ({ answer, value }) => {
  optBtns.forEach((b, i) => {
    b.disabled = true;
    if (i === answer) b.classList.add('correct');
    else if (i === myChoice) b.classList.add('wrong');
  });
  $('locked').classList.add('hidden');
  const r = $('result');
  if (myChoice === answer) { r.className = 'kbc-result good'; r.textContent = `✅ Correct! +${rupees(value)}`; Sound.play('go'); }
  else if (myChoice == null) { r.className = 'kbc-result bad'; r.textContent = '⏳ Too slow!'; }
  else { r.className = 'kbc-result bad'; r.textContent = '❌ Wrong!'; }
});

// --- results ---
socket.on('game:over', ({ results }) => {
  const idx = results.findIndex((p) => p.id === myId); const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji; $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName; $('resultScore').textContent = rupees(me.score || 0);
  show('results');
});
socket.on('game:lobby', () => { ready = false; const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋"; show('wait'); });
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
