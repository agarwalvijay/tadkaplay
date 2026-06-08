import { Sound } from '/shared/sounds.js';
import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), write: $('screen-write'), vote: $('screen-vote'), reveal: $('screen-reveal'), results: $('screen-results') };
const show = (n) => { for (const k in screens) screens[k].classList.toggle('hidden', k !== n); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const promptHTML = (p) => esc(p).replace(/_{2,}/, '<span class="blank">______</span>');
const norm = (s) => String(s).toLowerCase().trim().replace(/\s+/g, ' ');

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
let myId = null, myName = '', ready = false, joinedCode = null, myAnswer = '';
socket.on('connect', () => { if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId }); });
const saved = (() => { try { return JSON.parse(localStorage.getItem('fill_player') || '{}'); } catch { return {}; } })();
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
  try { localStorage.setItem('fill_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- write ---
socket.on('fill:write', ({ prompt }) => {
  myAnswer = '';
  $('writeQ').innerHTML = promptHTML(prompt);
  $('answerInput').value = ''; $('answerInput').disabled = false;
  $('writeSubmit').classList.remove('hidden'); $('writeSubmit').disabled = false;
  $('writeLocked').classList.add('hidden');
  show('write');
});
$('writeSubmit').onclick = () => {
  const text = $('answerInput').value.trim();
  if (!text) return;
  myAnswer = text;
  socket.emit('fill:submit', { text }, (res) => {
    if (res?.ok) {
      $('answerInput').disabled = true;
      $('writeSubmit').classList.add('hidden');
      $('writeLocked').classList.remove('hidden');
      Sound.play('join');
    }
  });
};

// --- vote ---
socket.on('fill:vote', ({ prompt, options }) => {
  $('voteQ').innerHTML = promptHTML(prompt);
  $('voteLocked').classList.add('hidden');
  const wrap = $('voteOpts'); wrap.innerHTML = '';
  options.forEach((o, i) => {
    const b = document.createElement('button'); b.className = 'vote-opt';
    const mine = myAnswer && norm(o.text) === norm(myAnswer);
    if (mine) { b.classList.add('mine'); b.disabled = true; }
    b.innerHTML = `<span class="letter">${String.fromCharCode(65 + i)}</span><span>${esc(o.text)}</span>`;
    b.onclick = () => {
      if (b.disabled) return;
      socket.emit('fill:castVote', { optionId: o.id }, (res) => {
        if (res?.ok) {
          [...wrap.children].forEach((c) => { c.disabled = true; });
          b.classList.add('picked');
          $('voteLocked').classList.remove('hidden');
          Sound.play('join');
        }
      });
    };
    wrap.appendChild(b);
  });
  show('vote');
});

// --- reveal ---
socket.on('fill:reveal', ({ options }) => {
  let msg = 'See how the room voted!';
  let scoreTxt = '';
  if (myAnswer) {
    const mine = options.find((o) => norm(o.text) === norm(myAnswer));
    if (mine) {
      const pts = mine.count * 100 + (mine.fav && mine.count > 0 ? 100 : 0);
      msg = mine.count ? `Your answer got ${mine.count} vote${mine.count === 1 ? '' : 's'}!` : 'No votes this time 😅';
      scoreTxt = pts ? `+${pts}` : '';
    }
  }
  $('revealMsg').textContent = msg;
  $('revealScore').textContent = scoreTxt;
  show('reveal');
  if (scoreTxt) Sound.play('go');
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
