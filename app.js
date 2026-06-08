import { SITE, GAMES } from './games.js';

// ---- header text -------------------------------------------------------
document.getElementById('kicker').textContent = SITE.kicker;
// each word wrapped so the shirorekha bar can sit per-word (breaks at spaces)
document.getElementById('deva').innerHTML =
  SITE.hero.split(' ').map((w) => `<span class="word">${w}</span>`).join(' ');
document.getElementById('subtitle').textContent = SITE.subtitle;
document.title = `${SITE.hero} — desi party games`;

// ---- resolve a live game's link relative to however you reached the hub,
//      so it works on localhost AND on your LAN IP ------------------------
function gameUrl(g) {
  if (g.url) return g.url;
  if (g.port) return `${location.protocol}//${location.hostname}:${g.port}${g.entry || '/'}`;
  return g.path || '#';
}

// ---- per-card hero graphics -------------------------------------------
// A reusable neon-glow filter for SVG strokes.
const GLOW = `<defs><filter id="g" x="-40%" y="-40%" width="180%" height="180%">
  <feGaussianBlur stdDeviation="2.4" result="b"/>
  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></defs>`;

// Word Combos: a mini 4x4 letter board with a lit swipe trail (spells WORD).
function wordBoardSVG() {
  const rows = ['WORD', 'AELS', 'TPIN', 'CHUM'];
  const T = 34, G = 6, x0 = 23, y0 = 12;
  let tiles = '';
  const cx = [], cy = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const x = x0 + c * (T + G);
      const y = y0 + r * (T + G);
      const lit = r === 0; // top row is the highlighted word
      tiles += `<rect x="${x}" y="${y}" width="${T}" height="${T}" rx="9"
        fill="${lit ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}"
        stroke="rgba(255,255,255,0.14)" stroke-width="1"/>`;
      tiles += `<text x="${x + T / 2}" y="${y + T / 2 + 6}" text-anchor="middle"
        font-family="'Baloo 2',sans-serif" font-weight="800" font-size="17"
        fill="${lit ? '#0a0612' : 'rgba(255,255,255,0.82)'}">${rows[r][c]}</text>`;
      if (lit) { cx.push(x + T / 2); cy.push(y + T / 2); }
    }
  }
  const pts = cx.map((x, i) => `${x},${cy[i]}`).join(' ');
  const trail = `<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="4.5"
    stroke-linecap="round" stroke-linejoin="round" opacity="0.95" filter="url(#g)"/>`;
  const dots = cx.map((x, i) => `<circle cx="${x}" cy="${cy[i]}" r="3.4" fill="#fff"/>`).join('');
  return `<svg class="art-gfx" viewBox="0 0 200 170" preserveAspectRatio="xMidYMid meet">
    ${GLOW}${tiles}${trail}${dots}</svg>`;
}

// Generic / coming-soon: a neon dot matrix with floating geometric shapes.
function patternSVG() {
  let dots = '';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 7; c++) {
      const x = 22 + c * 26;
      const y = 26 + r * 30;
      const on = Math.random() < 0.28;
      dots += `<circle cx="${x}" cy="${y}" r="${on ? 3.2 : 1.5}"
        fill="${on ? 'var(--accent)' : 'rgba(255,255,255,0.16)'}"/>`;
    }
  }
  const shapes = `
    <circle cx="46" cy="50" r="19" fill="none" stroke="var(--accent)" stroke-width="3" opacity="0.75" filter="url(#g)"/>
    <rect x="120" y="78" width="32" height="32" rx="7" transform="rotate(18 136 94)"
      fill="none" stroke="var(--accent2)" stroke-width="3" opacity="0.75" filter="url(#g)"/>
    <polygon points="152,26 170,56 134,56" fill="var(--accent2)" opacity="0.55" filter="url(#g)"/>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">
    ${GLOW}${dots}${shapes}</svg>`;
}

function artFor(g) {
  return g.gfx === 'wordboard' ? wordBoardSVG() : patternSVG();
}

// spice-level meter: 🌶️🌶️🌶️ with `n` lit
function spiceMeter(n) {
  if (!n) return '';
  const peppers = [1, 2, 3]
    .map((i) => `<span class="pepper${i <= n ? ' on' : ''}">🌶️</span>`)
    .join('');
  return `<span class="spice" title="Spice level ${n}/3">${peppers}</span>`;
}

// ---- build cards -------------------------------------------------------
const grid = document.getElementById('grid');

GAMES.forEach((g, i) => {
  const live = g.status === 'live';
  const card = document.createElement(live ? 'a' : 'div');
  card.className = `card ${live ? 'live' : 'soon'}`;
  card.style.setProperty('--accent', g.accent || '#4cc9f0');
  card.style.setProperty('--accent2', g.accent2 || g.accent || '#9b5de5');
  card.style.setProperty('--delay', `${0.08 * i + 0.1}s`);
  if (live) card.href = gameUrl(g);

  const chips = (g.meta || []).map((m) => `<span class="chip">${m}</span>`).join('');
  const metaInner = `${live ? spiceMeter(g.spice) : ''}${chips}`;

  card.innerHTML = `
    <div class="art">
      ${artFor(g)}
      <span class="art-chip">${g.icon || '🎮'}</span>
      ${live
        ? '<span class="badge live"><span class="dot"></span>Live</span>'
        : '<span class="badge soon">Soon</span>'}
    </div>
    <div class="body">
      <h2>${g.title}</h2>
      <p class="tagline">${g.tagline || ''}</p>
      ${metaInner ? `<div class="meta">${metaInner}</div>` : ''}
      ${live
        ? '<span class="play">Play <span class="arrow">▶</span></span>'
        : '<span class="soon-note">Cooking… 🍳</span>'}
    </div>
  `;

  grid.appendChild(card);
});

// ---- footer count ------------------------------------------------------
const liveCount = GAMES.filter((g) => g.status === 'live').length;
document.getElementById('footCount').textContent =
  `${liveCount} game${liveCount === 1 ? '' : 's'} ready to play`;

// ---- rising embers + popping spices -----------------------------------
const emberColors = ['var(--saffron)', 'var(--chili)', 'var(--turmeric)', 'var(--paprika)'];
const spiceGlyphs = ['🌶️', '✨', '⭐', '🟡'];
const floaters = document.getElementById('floaters');
const FLOATER_COUNT = 26;

for (let i = 0; i < FLOATER_COUNT; i++) {
  const isGlyph = Math.random() < 0.16;
  const el = document.createElement('span');
  el.style.left = `${Math.random() * 100}%`;
  el.style.setProperty('--d', `${7 + Math.random() * 12}s`);
  el.style.setProperty('--delay', `${-Math.random() * 16}s`);
  el.style.setProperty('--drift', `${(Math.random() - 0.5) * 80}px`);

  if (isGlyph) {
    el.className = 'glyph';
    el.textContent = spiceGlyphs[Math.floor(Math.random() * spiceGlyphs.length)];
    el.style.setProperty('--s', `${1.1 + Math.random() * 1.8}rem`);
  } else {
    el.className = 'ember';
    el.style.setProperty('--s', `${3 + Math.random() * 6}px`);
    el.style.setProperty('--c', emberColors[Math.floor(Math.random() * emberColors.length)]);
  }
  floaters.appendChild(el);
}

// ---- subtle 3D tilt on live cards (pointer devices only) --------------
const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (fine && !reduce) {
  document.querySelectorAll('.card.live').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform =
        `perspective(800px) rotateY(${px * 9}deg) rotateX(${-py * 9}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave', () => {
      card.style.transform = '';
    });
  });
}
