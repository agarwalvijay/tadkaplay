// Lightweight visual effects shared across screens.
const COLORS = ['#ff5d8f', '#ffd23f', '#06d6a0', '#4cc9f0', '#9b5de5', '#ff8c42', '#ff006e'];

export function confettiBurst(count = 120, duration = 3200) {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const size = 6 + Math.random() * 10;
    el.style.width = `${size}px`;
    el.style.height = `${size * (0.6 + Math.random())}px`;
    el.style.background = COLORS[(Math.random() * COLORS.length) | 0];
    el.style.left = `${Math.random() * 100}vw`;
    el.style.opacity = '1';
    document.body.appendChild(el);
    const xDrift = (Math.random() - 0.5) * 400;
    const rot = (Math.random() - 0.5) * 1080;
    const dur = duration * (0.6 + Math.random() * 0.6);
    el.animate(
      [
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${xDrift}px, 105vh) rotate(${rot}deg)`, opacity: 1 },
      ],
      { duration: dur, easing: 'cubic-bezier(.3,.6,.5,1)' }
    ).onfinish = () => el.remove();
  }
}

export function floatText(x, y, text, color = '#ffd23f') {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    font-family:'Baloo 2',sans-serif;font-weight:800;font-size:1.8rem;color:${color};
    text-shadow:0 2px 10px rgba(0,0,0,.5);z-index:80;pointer-events:none;`;
  document.body.appendChild(el);
  el.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.6)', opacity: 0 },
      { transform: 'translate(-50%,-110%) scale(1.2)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%,-220%) scale(1)', opacity: 0 },
    ],
    { duration: 1100, easing: 'ease-out' }
  ).onfinish = () => el.remove();
}

export function spawnBgLetters(n = 22) {
  const layer = document.createElement('div');
  layer.className = 'bg-letters';
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.textContent = letters[(Math.random() * 26) | 0];
    s.style.left = `${Math.random() * 100}vw`;
    s.style.fontSize = `${30 + Math.random() * 90}px`;
    s.style.animationDuration = `${14 + Math.random() * 22}s`;
    s.style.animationDelay = `${-Math.random() * 30}s`;
    layer.appendChild(s);
  }
  document.body.prepend(layer);
}
