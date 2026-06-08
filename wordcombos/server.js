// ===========================================================================
//  WORD COMBOS — standalone runner (optional).
//  The game normally runs inside the Arcade hub (../server.js). This lets you
//  run JUST this game on its own for development. Same URL prefix + namespace
//  as the hub, so the client code is identical either way.
//    node server.js   ->   http://localhost:3000/wordcombos/host
// ===========================================================================
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';
import { mountWordCombos } from './mount.js';

const PORT = process.env.PORT || 3000;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

mountWordCombos(app, io, { basePath: '/wordcombos', port: PORT });
app.get('/', (_req, res) => res.redirect('/wordcombos/host'));

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
  console.log('\n  🔤  WORD COMBOS (standalone) is live!');
  console.log(`  ┃  Host screen : http://${lan}:${PORT}/wordcombos/host`);
  console.log(`  ┃  Players join: http://${lan}:${PORT}/wordcombos/play\n`);
});
