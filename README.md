# SPECATHON 2026

A 24-hour college hackathon landing page — SPEC Technical Club · 11–12 September 2026.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS
- Framer Motion, GSAP, Lenis (smooth scroll)
- Lucide icons
- Supabase (Postgres) for registrations — see [`docs/architecture.md`](docs/architecture.md)
  for why there's no separate API server

## Project structure

```
frontend/    React/Vite/TypeScript app (the site itself)
backend/     Supabase SQL schema/migrations + the local CSV export/sync CLI
docs/        Architecture notes and Supabase setup guide
```

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown of
`frontend/src/` and how the frontend talks to Supabase.

## Getting started

```bash
npm install          # installs both workspaces (frontend + backend)
cp frontend/.env.example frontend/.env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env
npm run dev          # runs the frontend dev server (Vite, port 5173)
```

Build for production:

```bash
npm run build && npm run preview
```

Both commands run against the `frontend` workspace. To run a workspace
command directly: `npm run <script> -w frontend` or `npm run <script> -w backend`.

## Supabase setup

See [`docs/supabase-setup.md`](docs/supabase-setup.md) for the full walkthrough
(schema, env vars, migrations, exporting registrations).

Quick version:

```bash
cp backend/.env.example backend/.env
# fill in SUPABASE_SERVICE_ROLE_KEY in backend/.env (only needed for CSV sync)
npm run sync:csv     # live watcher -> backend/registrations/registrations.csv
npm run export:csv   # one-shot export
```

## Design notes

Dark futuristic aesthetic — plasma violet + lumen cyan on a near-black void, with a
signal-gold for numerics. Typography pairs Space Grotesk (display), Inter (body),
JetBrains Mono (utility), and Instrument Serif italics for accent breaks. The hero
runs as a mission-control console with a live countdown; every other section stays
disciplined so the signature holds.
