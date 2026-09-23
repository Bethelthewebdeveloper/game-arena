# Riddle Realm — Backend (Phase 20)

## Stack
- Node.js + Express
- MongoDB via Mongoose
- **Database name: `Riddles-Game`**

## MongoDB Compass setup

Compass is the GUI. The database can be **local** or **Atlas**; Compass connects to either.

### Local MongoDB + Compass
1. Install and start MongoDB Community (so port `27017` is listening).
2. Open Compass → New Connection → `mongodb://127.0.0.1:27017` → Connect.
3. In the project root:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env`:
   ```
   MONGODB_URI=mongodb://127.0.0.1:27017
   MONGODB_DB_NAME=Riddles-Game
   PORT=3000
   ```
5. `npm install` then `npm run test:db` then `npm start`.
6. In Compass: refresh → database **Riddles-Game** → collection **riddles** (after seed).

### Atlas + Compass
1. Atlas → Cluster → Connect → Compass → copy the connection string.
2. Put that string in `.env` as `MONGODB_URI` (never in frontend JS).
3. Atlas Network Access: allow your IP.
4. Same npm commands as above.
5. Compass → connect with the Atlas string → **Riddles-Game**.

## Commands
```bash
npm install
npm run test:db      # connection only
npm run seed:riddles # import local JSON riddles (dev)
npm start            # API http://localhost:3000
```

## Implemented API (Phase 20)
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api` | API index |
| GET | `/api/health` | Health + DB state |
| GET | `/api/riddles` | List riddles (`category`, `difficulty`, `limit`) |
| GET | `/api/riddles/:id` | One riddle |

Planned later (not implemented): `/api/auth`, `/api/users`, `/api/profile`, `/api/ai`, `/api/entitlements`, `/api/transactions`, …

## Security
- Secrets only in `.env` (gitignored)
- Never put `MONGODB_URI` in frontend
- Helmet, CORS, rate limit on `/api`
- Errors do not leak credentials

## Frontend
- Game still runs fully offline from Local Storage + `data/riddles-data.js`
- `js/api.js` can call the API when the server is up
- Static files can be served by Express on the same port

## Migration
See `docs/MIGRATION.md`
