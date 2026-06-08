// Keep the screen awake during a game (host TV + players' phones). The Screen
// Wake Lock API needs HTTPS (prod) and re-acquiring after the tab is hidden or
// the lock is released; some browsers also want a user gesture, so we retry on
// first interaction.
let lock = null;

async function acquire() {
  if (!('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener?.('release', () => { lock = null; });
  } catch { /* denied (no gesture yet / unsupported) — retry handlers below */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !lock) acquire();
});
['pointerdown', 'keydown', 'click'].forEach((ev) =>
  window.addEventListener(ev, () => { if (!lock) acquire(); }, { passive: true })
);

acquire();
