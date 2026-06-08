// Google Analytics (GA4) for Tadka Play. Loads gtag and tags every page with
// meaningful dimensions so the data is segmentable:
//   game        — 'hub' | 'wordcombos' | 'bluff' | 'doodle' | …
//   screen_role — 'landing' | 'host' | 'player'
// Plus a window.ttrack(name, params) helper for game events, e.g.
//   ttrack('game_created'), ttrack('player_joined'), ttrack('game_finished').
const ID = 'G-SPHDTQFCZB';

const seg = location.pathname.split('/').filter(Boolean);
const game = seg[0] && seg[0] !== 'shared' ? seg[0] : 'hub';
const role = /\/host$/.test(location.pathname) || /\/host\b/.test(location.pathname)
  ? 'host'
  : (/\/play\b/.test(location.pathname) ? 'player' : 'landing');

const s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
document.head.appendChild(s);

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = gtag;

gtag('js', new Date());
// attach our dimensions to every event (incl. the automatic page_view)
gtag('set', { game, screen_role: role });
gtag('config', ID, { game, screen_role: role });

window.ttrack = (name, params = {}) => gtag('event', name, { game, screen_role: role, ...params });
