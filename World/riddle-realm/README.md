# Riddle Realm

Browser riddle game + Node/Express API with MongoDB (**Riddles-Game**).

## Phase 1 competitive layer

Modes stay separate:

- Multiplayer host rooms: `/multiplayer/CODE` (capacity 2/4/8/10, host starts, live lobby poll, match questions, results)
- Global Multiplayer leaderboard: wins, then points, then games
- Public Battle: `/battle/CODE` (create / join / server-scored / own leaderboard)
- Score Challenge: `/challenge/CODE`
- Ranks screen tabs: Personal / Multiplayer / Battle
- Share links use the current site origin (not a fake domain)
- Founder dashboard is unchanged and still private

No fake users, scores, payments, or analytics.

# Run (required for multiplayer + Founder)

```bash
cp .env.example .env
# Edit .env: set FOUNDER_ACCESS_KEY and optionally MONGODB_URI
npm install
npm start
```

Open the game from the **same origin** as the API (do not use `file://`):

- Default: http://127.0.0.1:8080/ (or whatever `PORT` is in `.env`)
- Founder dashboard: http://127.0.0.1:8080/founder.html

**Multiplayer “Network Error”** means the browser cannot reach the API. Start `npm start` and open the game from that server URL.

## Founder access (Phase 26B)

1. Create a strong secret (password manager / secret generator).
2. Put it **only** in server env:

```
FOUNDER_ACCESS_KEY=your_private_secret
```

3. Never put the real secret in HTML, JS, GitHub, or API responses.
4. Open `/founder.html` → enter the key → dashboard loads with server-validated session.

Deployed hosts: set the same `FOUNDER_ACCESS_KEY` in the platform environment variables (e.g. Render / Railway / Vercel / Fly → Project → Environment).

## MongoDB + Compass

1. Copy env file: `cp .env.example .env`
2. Set `MONGODB_URI`:
   - Local: `mongodb://127.0.0.1:27017`
   - Atlas: paste URI from Atlas → Connect → Compass / Drivers
3. Keep `MONGODB_DB_NAME=Riddles-Game`
4. Optional: `npm run test:db` then `npm run seed:riddles`
5. In **MongoDB Compass**: same URI → database **Riddles-Game**

Without MongoDB the server still starts (`REQUIRE_DB=false`). Multiplayer uses in-memory rooms; daily/founder DB stats show “No data available yet.”

## Security

- Never commit `.env`
- Never put secrets or Mongo credentials in frontend JavaScript
- Founder analytics routes require a valid Founder session token
