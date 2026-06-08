# 🌶️ Tadka Play

Homemade party games with a desi twist — host on the big screen, everyone plays on their phones. Live at **[tadkaplay.com](https://tadkaplay.com)**.

A single Node server (`server.js`) serves the landing hub **and** every game in one process. Each game mounts under its own URL prefix + Socket.IO namespace.

## Games
- **Word Combos** — `/wordcombos/host` — a fast word-search party game (host screen + phone controllers).
- _More coming soon._

## Run locally
```bash
npm install
( cd wordcombos && npm install )
npm start            # http://localhost:8080
```
- Hub: `http://localhost:8080`
- Word Combos host: `http://localhost:8080/wordcombos/host`

Set `PORT` to change the port (e.g. `PORT=3000 npm start`).

## Add a game
1. Create a mountable module exposing `mount(app, io, { basePath })` (see `wordcombos/mount.js`).
2. Mount it in `server.js`.
3. Add an entry to the `GAMES` array in `games.js`.

## Deploy
Push to `main` → GitHub Actions rsyncs the app to the GCP box, runs `npm ci`, and reloads it under **pm2** (`ecosystem.config.cjs`), behind nginx. See `.github/workflows/deploy.yml`.
