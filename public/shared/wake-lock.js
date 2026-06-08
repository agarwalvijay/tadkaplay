// Keep the screen awake during a game (host TV + players' phones).
// Two layers, because no single approach is universal:
//   1. Screen Wake Lock API (Chrome/Android, Safari 16.4+) — re-acquired after
//      the tab is hidden / the lock is released.
//   2. Fallback: a muted, looping, inline canvas-stream video. Actively playing
//      media discourages the OS from sleeping where Wake Lock isn't honored
//      (older iOS, Low Power Mode). Started on the first user gesture.
let lock = null;

async function acquire() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener?.('release', () => { lock = null; });
  } catch { /* needs a gesture / unsupported — handlers below retry */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !lock) acquire();
});

let videoStarted = false;
function startVideoFallback() {
  if (videoStarted || !document.body) return;
  videoStarted = true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const ctx = canvas.getContext('2d');
    let on = false;
    setInterval(() => { on = !on; ctx.fillStyle = on ? '#000001' : '#000000'; ctx.fillRect(0, 0, 2, 2); }, 1000);
    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', '');
    v.playsInline = true; v.setAttribute('playsinline', '');
    v.loop = true;
    v.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-1';
    v.srcObject = canvas.captureStream(2);
    document.body.appendChild(v);
    v.play().catch(() => {});
  } catch { /* ignore */ }
}

function onGesture() { if (!lock) acquire(); startVideoFallback(); }
['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) =>
  window.addEventListener(ev, onGesture, { passive: true })
);

acquire();
