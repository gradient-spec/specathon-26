# Architecture

## Why there's no traditional "backend server"

SPECATHON 2026 is a React + Vite single-page app that talks directly to
[Supabase](https://supabase.com) (hosted Postgres + Auth + Storage + Realtime)
from the browser using the anon key. There is no custom Express/Fastify/Node
API server in this codebase — Supabase *is* the backend.

To keep the repo organized and scalable anyway, the project is split into two
workspaces:

```
frontend/   The React/Vite/TypeScript app — everything that ships to the browser.
backend/    Everything server-side: the Postgres schema/migrations that define
            Supabase's data model, RLS policies and RPCs, plus a Node CLI tool
            (scripts/sync-csv.mjs) that uses the service_role key to mirror
            registrations to a local CSV. This never runs in the browser.
```

## Data flow

```
┌─────────────┐   anon key (public)   ┌───────────────────┐
│  frontend/   │ ───────────────────► │  Supabase project  │
│  React SPA   │ ◄─────────────────── │  (Postgres + Auth  │
└─────────────┘   REST / Realtime     │   + Storage)        │
                                       └─────────┬──────────┘
                                                  │ service_role key (secret)
                                                  ▼
                                       ┌───────────────────┐
                                       │  backend/scripts/   │
                                       │  sync-csv.mjs        │
                                       │  (run locally by an  │
                                       │   organizer, not      │
                                       │   deployed)           │
                                       └───────────────────┘
```

- `frontend/src/services/supabase.ts` creates the browser client with the
  **anon** key (`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, both public-safe).
- `frontend/src/services/admin.ts` is the admin dashboard's data-access layer —
  it still uses the anon-key client, and access is gated by Supabase Row Level
  Security (`is_admin()`), not by a server.
- `backend/database/schema.sql` / `setup.sql` / `migrations/*.sql` define the
  tables, RLS policies, and the `register_team()` RPC — apply these in the
  Supabase SQL editor.
- `backend/scripts/sync-csv.mjs` is an operator tool that uses the
  **service_role** secret key (never exposed to the browser) to export/watch
  registrations into `backend/registrations/registrations.csv`.

## Frontend structure

```
frontend/src/
  components/   Shared section + UI components (Hero, Navbar, Gallery, ...)
  pages/        Route-level pages (Home)
  admin/        Admin dashboard feature module (login, dashboard, tables, charts)
  hooks/        Reusable hooks (useLenis, useCountdown)
  services/     Data-access layer (Supabase client, admin queries)
  utils/        Constants, static asset manifest, export helpers
```
