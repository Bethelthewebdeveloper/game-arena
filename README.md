# Game Arena

Public landing page plus session auth, a shared XP system, and seven playable games.

## Run

```bash
node server.js
```

Open http://localhost:3000

No npm packages required. The server uses Node's built-in `http`, `fs`, and `crypto` modules.

## What is included

- Landing page (`/`) with hero, games, how it works, progression, AI companion (Riddle Game only), plans, leaderboard preview, and footer
- Existing-style auth at `/login` and `/signup`
- Dashboard at `/dashboard`
- Games under `/games/`
- Player data in `data/users.json` and `data/scores.json`

Play Now and game buttons send guests to login and signed-in players to the dashboard or that game.
