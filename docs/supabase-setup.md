# Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run [`backend/database/schema.sql`](../backend/database/schema.sql)
   (or [`backend/database/setup.sql`](../backend/database/setup.sql) for the
   consolidated, idempotent one-paste version). This creates:
   - `teams` — one row per team, with all leader/contact fields
   - `team_members` — additional team members, keyed to `teams.id`
   - `registrations_export` view — a flat, admin-friendly view for CSV/XLSX export
   - the `register_team()` RPC — the only endpoint the public site uses to submit a registration
3. Grab the project URL and anon key from **Project settings → API** and paste
   into `frontend/.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
4. Grab the `service_role` secret (same page) and paste into `backend/.env`
   (`SUPABASE_SERVICE_ROLE_KEY`) — only needed if you run the CSV sync tool.
   **Never** put this key in `frontend/.env` or ship it to the browser.

Row-level security is enabled with insert-only access (via the RPC) for the
anon role; reads require an authenticated admin session on the allowlist
(`public.admins`, enforced by `public.is_admin()`).

## Migrations

Incremental migrations live in `backend/database/migrations/` and are applied
in order:

1. `0001_rls_policies.sql`
2. `0002_admin_and_extended_fields.sql`
3. `0003_extended_registration.sql`

`backend/database/setup.sql` is the consolidated, idempotent equivalent — safe
to re-run any time, e.g. against a fresh project.

## Exporting registrations

- **CSV (manual):** open the `registrations_export` view in the Supabase table
  editor and click "Download CSV".
- **CSV (automated, live):** from `backend/`, run `npm run sync:csv` to watch
  Supabase Realtime and continuously rewrite `backend/registrations/registrations.csv`,
  or `npm run export:csv` for a one-shot export.
- **XLSX:** any SQL client (Beekeeper, DBeaver, DataGrip) can export the view
  directly to `.xlsx`.
