// ===========================================================================
//  ARCADE HUB — the single server for the landing page AND every game.
//  Each game mounts onto this Express app + Socket.IO server under its own
//  URL prefix and socket namespace, so everything runs in ONE process.
//  Add a game = import its module and call its mount() below.
// ===========================================================================
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

import { mountWordCombos } from './wordcombos/mount.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// ---- mounted games (URL prefix + socket namespace each) ----
mountWordCombos(app, io, { basePath: '/wordcombos', port: PORT });
// future games: mountTrivia(app, io, { basePath: '/trivia', port: PORT }); ...

// ---- assets shared by all games (theme.css, sounds.js, fx.js, avatars.js) ----
app.use('/shared', express.static(join(__dirname, 'public', 'shared')));

// ---- the landing hub (index.html, landing.css, app.js, games.js) ----
app.use(express.static(__dirname, { index: 'index.html' }));

function lanAddress() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

httpServer.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddress();
  console.log(`
  🕹  ARCADE is live!  (single server, all games)
  ┃  This screen : http://localhost:${PORT}
  ┃  On your LAN : http://${lan}:${PORT}
  ┃  Word Combos : http://${lan}:${PORT}/wordcombos/host
`);
});
