# Local Storage → MongoDB migration plan

## Keep on device (local)
- Theme, text size, reduced motion, high contrast
- SFX / music / haptic toggles
- Marketing consent
- Demo Pro flag (dev only — remove for production)
- Temporary UI state

## Move to MongoDB (with accounts — Phase 21+)
| Local key / domain | Future collection / field |
|--------------------|---------------------------|
| `rr_player` | `playerprogresses` / users |
| XP, level, coins | player progress |
| Streaks | player progress + streak docs |
| Achievements | `userachievements` |
| Missions | `usermissions` |
| AI usage | `aiusages` (server-enforced) |
| Verified Pro | `entitlements` (server-only) |
| Leaderboard personal | optional cloud scores |
| Shop ownership | inventory under user |

## Strategy
1. Phase 20: Mongo ready; frontend still local-first
2. Phase 21: Auth + cloud profile sync
3. Merge: server wins for entitlements/currency; client preferences stay local
4. Never delete local data until sync confirmed

## Do not
- Auto-wipe Local Storage in Phase 20
- Trust client `coins` / `plan=pro` as server truth later
