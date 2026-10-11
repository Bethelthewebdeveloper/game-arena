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


## Pro waitlist email

Waitlist records save without email. Founder mail is sent only when these Vercel env vars are set:

- EMAIL_PROVIDER=`resend` or `sendgrid`
- EMAIL_API_KEY=your provider API key
- EMAIL_FROM=a verified sender (for Resend: `Game Arena <you@yourdomain>`)
- WAITLIST_NOTIFICATION_EMAIL=betheljahbuikemonuoha@gmail.com

If those are missing, the user still joins the waitlist and sees that the notification could not be delivered. Passwords are never stored or emailed.


## Studio Phase 2

Published games use a stable public URL at `/g/<slug>`. Duplicate titles get a unique slug from the internal game id.

- DRAFT stays private.
- PUBLISHED appears on Community Games and the creator profile.
- UNPUBLISHED is removed from public discovery and kept for the creator.
- Likes require a signed-in player and toggle once per account.
- Play counts increase once per player (or address) per hour, not on every refresh.
- Studio blocks are data, not creator JavaScript.
- Pro remains Join the Waitlist. There is no checkout.


## Studio Phase 3

Free Studio includes 5 projects, 5 published games, 100 MB storage, 10 custom assets per game, up to 20 levels, and basic analytics. Playing, sharing, likes, public links, and creator profiles stay available.

Pro limits and advanced analytics exist as entitlements, but there is no payment provider. Join the Waitlist does not activate Pro, create a subscription, or write a receipt.

Account, plan, subscription status, waitlist status, and feature entitlements are stored separately so a real provider can be added later.
