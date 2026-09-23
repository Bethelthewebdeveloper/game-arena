# Game Arena — owner setup

Do not put real passwords, API keys, or payment secrets in the repo.

## 1. Environment

Copy `.env.example` to `.env`.

Required for accounts and saved scores:

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/
MONGODB_DB_NAME=Riddles-Game
FOUNDER_ACCESS_KEY=your-long-random-secret
```

Optional:

```
APP_PUBLIC_URL=https://your-real-domain.com
AI_API_KEY=
AI_MODEL=
PAYMENT_PROVIDER=
PAYMENT_SECRET=
```

## 2. Run

```
npm install
npm start
```

- Public landing: http://127.0.0.1:8080/
- Game: http://127.0.0.1:8080/play
- Owner dashboard: http://127.0.0.1:8080/founder.html

## 3. First Owner

Public signup only creates **player** accounts.

Owner access uses `FOUNDER_ACCESS_KEY` on `/founder.html`.  
Do not publish that key. Change it when you transfer the product.

Optional CLI (uses env, not hardcoded accounts):

```
npm run create-founder
```

## 4. Payments

Pro payments are not configured. Leave payment vars empty until you add a provider.

## 5. AI

Riddle Companion calls `/api/ai`. Keys stay in `.env` only. If `AI_API_KEY` is empty, the UI shows an unavailable state instead of a fake answer.
