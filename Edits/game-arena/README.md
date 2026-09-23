# Game Arena

Skill-based mini-game platform. Public landing page, session auth, shared XP progression, and twelve playable games.

## Run locally

```bash
node server.js
```

Open http://localhost:3000

`npm start` runs the same command. There is no frontend build step. Tailwind is loaded from the official CDN.

Requires Node.js 18 or newer.

## Production start

```bash
NODE_ENV=production node server.js
```

The process listens on `0.0.0.0:$PORT`.

## Environment

See `.env.example`.

- PORT — listen port (injected by most hosts)
- HOST — bind address, default 0.0.0.0
- NODE_ENV — production enables Secure cookies
- COOKIE_SECURE — force Secure session cookies
- DATA_DIR — writable folder for users.json and scores.json

This project does not use MongoDB, MySQL, JWT, WebSockets, or a separate frontend origin.

## Hosting shape

- Frontend and backend are the same Node process.
- Needs a persistent Node server (Render, Railway, Fly.io, a VPS). Not a static-only host such as GitHub Pages.
- Needs a writable disk for data/ or DATA_DIR. In-memory sessions reset when the process restarts.
- Health check: GET /healthz
