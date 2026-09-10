# Live Leaderboard (`/leaderboard`)

The standalone `specathon-2026-leaderboard` app (Express + tRPC + MySQL) was
**ported onto this repo's Supabase backend** and now ships as part of the SPA.
No separate server, no MySQL.

## Routes

| Path | Access | What it is |
|---|---|---|
| `/leaderboard` | Public | Live ranking display — 36h hackathon timer, stage banner, venue-group filter, auto-refresh every 5s. |
| `/leaderboard/admin` | Admin (`RequireAdmin` → `is_admin()`) | Control center — Excel roster import, score entry, event-stage/schedule controls, venue groups, score audit trail. |

The admin surface reuses the **existing** Supabase admin session (the same
allow-list that gates `/admin/dashboard`). The old app's separate
email/password + Manus OAuth login was dropped.

## Code

```
frontend/src/leaderboard/
  ranking.ts        deterministic rank ordering  (verbatim port of server/ranking.ts)
  schedule.ts       schedule → stage derivation  (verbatim port of server/schedule.ts)
  types.ts          row/DTO types
  service.ts        data-access layer (replaces the tRPC router)
  leaderboard.css   scoped styles (all rules under .lb-root)
  *.test.ts         ranking + schedule unit tests (ported)
frontend/src/pages/
  Leaderboard.tsx       public page  (port of client/src/pages/Home.tsx)
  LeaderboardAdmin.tsx  admin page   (port of client/src/pages/Admin.tsx)
```

Nav entry: a "Live Leaderboard →" link in `components/Footer.tsx`.
Asset: `frontend/public/gradient-club-logo.png`.

## Database

Apply the migration once against the Supabase project:

```
supabase/migrations/20260909000000_leaderboard_schema.sql
```

It creates six `leaderboard_*` tables (prefixed to avoid colliding with the V1
`teams` roster), enables RLS (public `SELECT`, admin-only writes), seeds the
singleton `leaderboard_event_settings` row, adds the tables to the Realtime
publication, and installs the RPCs:

| RPC | Purpose |
|---|---|
| `leaderboard_tick_stage()` | Persist the schedule-derived stage; called opportunistically by the public page on load. `anon`-executable, idempotent. |
| `leaderboard_set_score(team_id, round, score)` | Upsert one round score **+** write the audit row atomically. `is_admin()` only. |
| `leaderboard_clear_score(team_id, round)` | Clear one round score + audit. `is_admin()` only. |
| `leaderboard_import_teams(rows jsonb)` | Upsert the roster from the Excel import; never touches scores. `is_admin()` only. |

Venue-group edits, team-detail edits and settings edits go through RLS on the
tables directly (no RPC).

## Not ported

- The standalone Node server, Vite dev server, and MySQL schema.
- Manus OAuth + the app's own scrypt admin login.
- `@aws-sdk/*` storage proxy (unused by the leaderboard feature).
- The auto-advance **server ticker** — instead the stage is recomputed on each
  public page load via `leaderboard_tick_stage()`, and the client also overlays
  the schedule-derived stage for display between loads.
