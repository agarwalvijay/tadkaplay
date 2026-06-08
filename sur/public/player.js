import { EMOJIS, COLORS, randomName, randomAvatar } from '/shared/avatars.js';

const NS = '/' + (location.pathname.split('/').filter(Boolean)[0] || '');
const socket = io(NS);
const $ = (id) => document.getElementById(id);
const screens = { join: $('screen-join'), wait: $('screen-wait'), play: $('screen-play'), vote: $('screen-vote'), results: $('screen-results') };
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
let myId = null, myName = '', ready = false, joinedCode = null, myInst = null;
socket.on('connect', () => { if (joinedCode) socket.emit('player:join', { code: joinedCode, name: myName, avatar, playerId: myId }); });
const saved = (() => { try { return JSON.parse(localStorage.getItem('sur_player') || '{}'); } catch { return {}; } })();
const showErr = (m) => { const e = $('joinError'); e.textContent = m; e.classList.remove('hidden'); };

$('joinBtn').onclick = () => {
  const code = $('codeInput').value.trim().toUpperCase();
  if (code.length < 4) return showErr('Enter the 4-letter room code');
  myName = ($('nameInput').value.trim() || randomName()).slice(0, 16);
  socket.emit('player:join', { code, name: myName, avatar, playerId: saved.playerId });
};
socket.on('player:joinError', () => showErr('Room not found — check the code.'));
socket.on('player:joined', ({ id, code, name, avatar: av, spectator }) => {
  myId = id; myName = name; joinedCode = code;
  try { localStorage.setItem('sur_player', JSON.stringify({ playerId: id, name, avatar })); } catch {}
  $('waitAvatar').textContent = av.emoji; $('waitAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${av.color})`;
  $('waitName').textContent = name; $('spectatorNote').classList.toggle('hidden', !spectator);
  show('wait'); socket.emit('sur:whoami'); window.ttrack?.('player_joined');
});
$('readyBtn').onclick = () => { ready = !ready; socket.emit('player:setReady', { ready }); const b = $('readyBtn'); b.classList.toggle('is-ready', ready); b.textContent = ready ? 'Ready! ✋ (tap to cancel)' : "I'm Ready! ✋"; };

// --- instrument + pads ---
socket.on('sur:instrument', ({ instrument }) => { myInst = instrument; renderPads(); });
function renderPads() {
  const wrap = $('pads'); wrap.innerHTML = '';
  if (!myInst) { $('instName').textContent = ''; return; }
  $('instName').textContent = `${myInst.emoji} ${myInst.name}`;
  wrap.className = 'pads n' + myInst.pads.length;
  myInst.pads.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'pad'; b.textContent = p.label;
    const tap = (e) => {
      e.preventDefault();
      socket.emit('sur:hit', { pad: i });
      b.classList.add('hit'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('hit'), 110);
    };
    b.addEventListener('pointerdown', tap);
    wrap.appendChild(b);
  });
}

// --- phases ---
socket.on('sur:phase', (p) => {
  if (p.phase === 'jam') {
    if (!myInst) socket.emit('sur:whoami');
    $('surHeader').textContent = '🎶 JAM! Tap to play';
    show('play');
  } else if (p.phase === 'solo') {
    if (p.soloId === myId) $('surHeader').textContent = '🎤 YOUR SOLO — go off!';
    else $('surHeader').textContent = `🎧 ${p.soloName} is soloing…`;
    show('play');
  } else if (p.phase === 'vote') {
    $('voteLocked').classList.add('hidden');
    const wrap = $('voteOpts'); wrap.innerHTML = '';
    (p.options || []).forEach((o) => {
      const b = document.createElement('button'); b.className = 'vote-opt';
      if (o.id === myId) { b.classList.add('mine'); b.disabled = true; }
      const av = document.createElement('div'); av.className = 'avatar'; av.textContent = o.avatar.emoji;
      av.style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${o.avatar.color})`;
      const nm = document.createElement('span'); nm.textContent = o.name + (o.id === myId ? ' (you)' : '');
      b.append(av, nm);
      b.onclick = () => {
        if (b.disabled) return;
        socket.emit('sur:castVote', { playerId: o.id }, (res) => {
          if (res?.ok) { [...wrap.children].forEach((c) => { c.disabled = true; }); b.classList.add('picked'); $('voteLocked').classList.remove('hidden'); }
        });
      };
      wrap.appendChild(b);
    });
    show('vote');
  }
});

// --- results ---
socket.on('game:over', ({ results }) => {
  const idx = results.findIndex((p) => p.id === myId); const me = results[idx] || {};
  $('rankBig').textContent = idx === 0 ? '🏆 #1' : (idx >= 0 ? '#' + (idx + 1) : '—');
  $('resultAvatar').textContent = avatar.emoji; $('resultAvatar').style.background = `radial-gradient(circle at 30% 25%, #ffffff66, ${avatar.color})`;
  $('resultName').textContent = myName; $('resultScore').textContent = (me.score || 0).toLocaleString();
  show('results');
});
socket.on('game:lobby', () => { ready = false; const b = $('readyBtn'); b.classList.remove('is-ready'); b.textContent = "I'm Ready! ✋"; myInst = null; show('wait'); });
socket.on('host:left', () => showErr('Host left. Refresh to join a new game.'));
