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

// Bluff: stacked multiple-choice answers, one marked as the truth.
function bluffSVG() {
  const rows = [{ y: 30, l: 'A', tw: 92, truth: false }, { y: 68, l: 'B', tw: 72, truth: true }, { y: 106, l: 'C', tw: 100, truth: false }];
  let r = '';
  rows.forEach((row) => {
    r += `<rect x="22" y="${row.y}" width="156" height="30" rx="15" fill="rgba(255,255,255,0.06)"
      stroke="${row.truth ? 'var(--accent)' : 'rgba(255,255,255,0.14)'}" stroke-width="${row.truth ? 2.5 : 1}"/>`;
    r += `<circle cx="40" cy="${row.y + 15}" r="11" fill="${row.truth ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}"/>`;
    r += `<text x="40" y="${row.y + 20}" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="13" fill="${row.truth ? '#0a0612' : 'rgba(255,255,255,0.85)'}">${row.l}</text>`;
    r += `<rect x="60" y="${row.y + 11}" width="${row.tw}" height="7" rx="3.5" fill="rgba(255,255,255,0.18)"/>`;
    if (row.truth) r += `<path d="M150 ${row.y + 16} l5 6 l11 -14" stroke="#06d6a0" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)"/>`;
  });
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// Doodle: a paintbrush dragging a wavy stroke, with a couple of sparkles.
function doodleSVG() {
  const sparks = `<circle cx="40" cy="42" r="3" fill="var(--accent2)" opacity="0.7"/>
    <circle cx="120" cy="34" r="2.4" fill="var(--accent)" opacity="0.6"/>
    <path d="M58 26 v9 M53.5 30.5 h9" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" opacity="0.7"/>`;
  const stroke = `<path d="M24 122 Q 54 68 88 100 T 150 74" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" filter="url(#g)"/>`;
  const brush = `<line x1="150" y1="74" x2="186" y2="40" stroke="var(--accent2)" stroke-width="10" stroke-linecap="round"/>
    <circle cx="150" cy="74" r="10" fill="var(--accent)"/>
    <circle cx="187" cy="39" r="6" fill="rgba(255,255,255,0.55)"/>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid slice">${GLOW}${sparks}${stroke}${brush}</svg>`;
}

// Crorepati: a glowing money ladder, the top rung is the jackpot.
function crorepatiSVG() {
  const defs = `<defs>
    <linearGradient id="kbc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient>
    <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const rungs = [{ y: 122, w: 58 }, { y: 100, w: 82 }, { y: 78, w: 106 }, { y: 56, w: 130 }];
  let r = '';
  rungs.forEach((g_) => {
    r += `<rect x="${(200 - g_.w) / 2}" y="${g_.y}" width="${g_.w}" height="15" rx="7.5" fill="rgba(255,255,255,0.09)" stroke="rgba(255,255,255,0.14)"/>`;
  });
  // jackpot rung
  r += `<rect x="20" y="28" width="160" height="22" rx="11" fill="url(#kbc)" filter="url(#g)"/>`;
  r += `<text x="100" y="44" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="14" fill="#0a0612">₹ CROREPATI</text>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${defs}${r}</svg>`;
}

// Andaaza: a spectrum bar with a bullseye target and a couple of guess dots.
function spectrumSVG() {
  const defs = `<defs>
    <linearGradient id="spec" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--accent2)"/></linearGradient>
    <filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>`;
  const x = 18 + 164 * 0.62;
  let r = `<rect x="18" y="78" width="164" height="20" rx="10" fill="url(#spec)"/>`;
  r += `<rect x="${x - 14}" y="74" width="28" height="28" rx="8" fill="rgba(255,255,255,0.28)"/>`;
  r += `<rect x="${x - 2}" y="66" width="4" height="44" rx="2" fill="#fff" filter="url(#g)"/>`;
  r += `<text x="${x}" y="56" text-anchor="middle" font-size="22">🎯</text>`;
  r += `<circle cx="${18 + 164 * 0.38}" cy="88" r="8" fill="#fff" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>`;
  r += `<circle cx="${18 + 164 * 0.72}" cy="88" r="8" fill="#fff" stroke="rgba(0,0,0,0.3)" stroke-width="2"/>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${defs}${r}</svg>`;
}

// Khaali Jagah: an answer card with a highlighted blank + a vote star.
function fillSVG() {
  let r = `<rect x="22" y="38" width="156" height="84" rx="14" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.14)"/>`;
  r += `<rect x="38" y="58" width="90" height="9" rx="4.5" fill="rgba(255,255,255,0.22)"/>`;
  r += `<rect x="38" y="80" width="58" height="12" rx="6" fill="var(--accent)" filter="url(#g)"/>`;
  r += `<rect x="104" y="80" width="38" height="9" rx="4.5" fill="rgba(255,255,255,0.22)"/>`;
  r += `<rect x="38" y="102" width="108" height="9" rx="4.5" fill="rgba(255,255,255,0.18)"/>`;
  r += `<text x="150" y="52" font-size="26">⭐</text>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// Sur: an equalizer of sound bars dancing under a music note.
function surSVG() {
  const heights = [42, 72, 56, 88, 50, 78, 46];
  let r = '';
  heights.forEach((h, i) => {
    const x = 28 + i * 22;
    r += `<rect x="${x}" y="${126 - h}" width="14" height="${h}" rx="7" fill="${i % 2 ? 'var(--accent2)' : 'var(--accent)'}" filter="url(#g)"/>`;
  });
  r += `<text x="100" y="42" text-anchor="middle" font-size="26">🎵</text>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// Hil Mat: a tilted platform on a pivot with cargo balanced on top.
function hilSVG() {
  let r = `<rect x="96" y="92" width="8" height="42" rx="3" fill="rgba(255,255,255,0.18)"/>`;
  r += `<g transform="rotate(-13 100 92)">`;
  r += `<rect x="36" y="86" width="128" height="13" rx="6" fill="var(--accent)" filter="url(#g)"/>`;
  [62, 86, 110, 134].forEach((x) => { r += `<circle cx="${x}" cy="77" r="9" fill="var(--accent2)"/>`; });
  r += `</g>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// Tadka Tashan: spices dropping into a sizzling kadhai.
function panSVG() {
  let r = `<ellipse cx="100" cy="126" rx="46" ry="10" fill="var(--accent)" opacity="0.32" filter="url(#g)"/>`;
  r += `<text x="100" y="122" text-anchor="middle" font-size="60">🍳</text>`;
  [['🌶️', 64, 54], ['🟡', 100, 42], ['🧄', 136, 56]].forEach(([e, x, y]) => { r += `<text x="${x}" y="${y}" text-anchor="middle" font-size="26">${e}</text>`; });
  r += `<text x="100" y="86" text-anchor="middle" font-size="20">✨</text>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// Bhediya: suspects in a line-up, the wolf spotted under a magnifier.
function wolfSVG() {
  let r = '';
  const xs = [52, 100, 148], faces = ['🙂', '🐺', '🙃'];
  xs.forEach((x, i) => {
    const wolf = i === 1;
    r += `<circle cx="${x}" cy="72" r="24" fill="${wolf ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}" stroke="${wolf ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}" stroke-width="2" ${wolf ? 'filter="url(#g)"' : ''}/>`;
    r += `<text x="${x}" y="82" text-anchor="middle" font-size="26">${faces[i]}</text>`;
  });
  r += `<circle cx="118" cy="92" r="17" fill="none" stroke="#fff" stroke-width="4" opacity="0.9"/>`;
  r += `<line x1="131" y1="105" x2="150" y2="124" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`;
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

// NPAC: a big letter tile beside a ticked-off scoresheet.
function npacSVG() {
  let r = `<rect x="20" y="44" width="62" height="62" rx="13" fill="var(--accent)" filter="url(#g)"/>`;
  r += `<text x="51" y="92" text-anchor="middle" font-family="'Baloo 2',sans-serif" font-weight="800" font-size="44" fill="#06121a">A</text>`;
  [56, 72, 88, 104].forEach((y, i) => {
    r += `<rect x="98" y="${y}" width="${[70, 58, 80, 52][i]}" height="7" rx="3.5" fill="rgba(255,255,255,0.22)"/>`;
    r += `<path d="M182 ${y + 3} l4 5 l9 -12" stroke="var(--accent2)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  return `<svg class="art-gfx" viewBox="0 0 200 160" preserveAspectRatio="xMidYMid meet">${GLOW}${r}</svg>`;
}

function artFor(g) {
  switch (g.gfx) {
    case 'sheet': return npacSVG();
    case 'wolf': return wolfSVG();
    case 'wordboard': return wordBoardSVG();
    case 'bluff': return bluffSVG();
    case 'doodle': return doodleSVG();
    case 'crorepati': return crorepatiSVG();
    case 'spectrum': return spectrumSVG();
    case 'fill': return fillSVG();
    case 'sur': return surSVG();
    case 'tilt': return hilSVG();
    case 'pan': return panSVG();
    default: return patternSVG();
  }
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

// ---- "rejoin your game" banner -----------------------------------------
// If you left a live game (hit Home / refreshed), offer a one-tap way back in.
(() => {
  let sess; try { sess = JSON.parse(localStorage.getItem('tadka_session') || 'null'); } catch { sess = null; }
  if (!sess || !sess.game || !sess.code) return;
  if (Date.now() - (sess.at || 0) > 30 * 60 * 1000) { localStorage.removeItem('tadka_session'); return; }
  const game = GAMES.find((g) => g.path === `${sess.game}/host`) || {};
  const bar = document.createElement('div');
  bar.className = 'rejoin-banner';
  bar.innerHTML = `
    <a class="rj-link" href="${sess.game}/play?room=${encodeURIComponent(sess.code)}">
      <span class="rj-emoji">${game.icon || '🎮'}</span>
      <span class="rj-text">Rejoin your game${game.title ? ` — <b>${game.title}</b>` : ''} <span class="rj-code">${sess.code}</span></span>
      <span class="rj-go">Rejoin ↪</span>
    </a>
    <button class="rj-x" title="Dismiss" aria-label="Dismiss">✕</button>`;
  bar.querySelector('.rj-x').onclick = () => { localStorage.removeItem('tadka_session'); bar.remove(); };
  document.body.appendChild(bar);
})();

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
