# Investigation Report — Shortlisted Team Data Flow

Pure trace, no files modified during this investigation.

---

## 1. CSV Import Flow

```
CSV file (browser)
  → frontend/src/admin/ShortlistImport.tsx  (hand-rolled parseCsv — no library)
  → frontend/src/services/admin.ts → importShortlisted(rows)
  → supabase.rpc("import_shortlisted_teams", { rows })
  → Postgres function public.import_shortlisted_teams(rows jsonb)  [SECURITY DEFINER]
  → INSERT ... ON CONFLICT (team_id) DO UPDATE  →  public.shortlisted_teams
  → (side effect, fire-and-forget) syncSheetForTeams(teamIds)
       → POST {VITE_SUPABASE_URL}/functions/v1/sync-sheet  → Google Sheet mirror
```

- **Route:** `/admin/dashboard` (tab, not a distinct path) — `Dashboard.tsx` switches between `ShortlistImport` and `PaymentDashboard`.
- **Required CSV headers** (`REQUIRED_HEADERS` in `ShortlistImport.tsx`, exact match, no extras allowed): `team_id, registration_source, team_name, team_lead_name, contact, team_size, amount, payment_status, payment_notes`.
- **Client parsing:** custom quote-aware tokenizer (`splitLines`/`parseFields`); `payment_status` is force-overwritten to `"PENDING"` client-side before the row is even sent, regardless of CSV content.
- **Persistence call:** direct Supabase RPC, not a REST insert, not an edge function.
- **RPC name:** `import_shortlisted_teams(rows jsonb)`, defined across `0009`, rewritten in `0011`, extended in `0012`.
- **Table written:** `public.shortlisted_teams` only.
- **Columns written by upsert:** `team_id, registration_source, team_name, team_lead_name, contact, email, team_size, amount` (email resolved from CSV, or backfilled from `public.teams.reg_code` for `WEBSITE` rows).
- **Insert vs update:** `ON CONFLICT (team_id) DO UPDATE` — same `team_id` re-import updates the existing row; new `team_id` inserts a new row.
- **payment_status behavior:** On **first insert**, `payment_status` is written (as `'PENDING'`, validated by the RPC). On **conflict (re-import)**, the `DO UPDATE SET` clause explicitly **excludes** `payment_status`, `payment_notes`, `paid_at` — confirmed by reading `0011_v2_rls_policies_and_upsert.sql`'s `ON CONFLICT` column list, which only lists `registration_source, team_name, team_lead_name, contact, email, team_size, amount`. Re-uploading the same CSV **cannot** overwrite payment progress.
- **Side effects:** `sync-sheet` Edge Function call (Google Sheet mirror) after successful import; no cache layer; no other synchronization found.

---

## 2. Admin Payments Flow

```
Admin loads /admin/dashboard → PaymentDashboard tab
  → frontend/src/admin/PaymentDashboard.tsx  (mount + whenever lastImport prop changes)
  → frontend/src/services/admin.ts → listShortlistedTeams()
  → supabase.from("shortlisted_teams").select("*").order("team_id", { ascending: true })
  → public.shortlisted_teams   (direct table read, RLS-gated: admin_select_shortlisted_teams policy, is_admin())
```

- **Route:** `/admin/dashboard` (same page as import, different tab). Guarded by `RequireAdmin`.
- **Component:** `frontend/src/admin/PaymentDashboard.tsx` (+ `PaymentDetailsDrawer` sub-component in the same file).
- **Service:** `listShortlistedTeams()` in `frontend/src/services/admin.ts` — `select("*")`, no column allowlist, sorted by `team_id` ascending, no server-side filter/pagination (fetches all rows; search box filters client-side in-memory).
- **Drawer timeline:** `listPaymentEventsForTeam(shortlistedTeamId)` → `supabase.from("payment_events").select("*").eq("shortlisted_team_id", ...).order("created_at")`.
- **Editable field:** only `payment_notes`, via `updatePaymentNotes(id, notes)` → `supabase.from("shortlisted_teams").update({ payment_notes })`. Source comment explicitly states it never touches `payment_status`, `amount`, or `paid_at`. No UI path exists on this page to manually change `payment_status`.
- **Table:** `public.shortlisted_teams` directly — no view, no RPC, no edge function in the read path. No `create view` statements exist anywhere in `backend/database/migrations/`.
- **Relationship to CSV import:** Confirmed by code, not inferred — `listShortlistedTeams()` reads the exact same `shortlisted_teams` table that `import_shortlisted_teams()` writes to. The `lastImport` prop (a counter/timestamp bumped by `Dashboard.tsx` after a successful `ShortlistImport` run) triggers `PaymentDashboard` to refetch, so newly imported rows appear here immediately after import.

**Conclusion for Part 2: Admin Payments IS reading the CSV-imported records directly, with no intermediate layer.**

---

## 3. Shortlist Search Flow

```
Public homepage → ShortlistPortal.tsx (#shortlist-portal section)
  → ShortlistTerminal.tsx → runCheck(q) → searchTeam(q)
  → frontend/src/services/mockShortlist.ts
  → in-memory array DEV_TEAM_DATA (5 hard-coded fake teams: Alpha/Beta/Gamma/Delta/Nova)
```

- **Route:** Home page (`/`), the `ShortlistPortal` section (`id="shortlist-portal"`).
- **Searching component:** `frontend/src/components/ShortlistTerminal.tsx`.
- **Function called on search:** `searchTeam(query)`, imported as `import { searchTeam, type MockTeam } from "@/services/mockShortlist"`.
- **Data source:** **Not** `shortlisted_teams`. **Not** any RPC. **Not** the `shortlisted-teams` Edge Function. It is a static, hard-coded TypeScript array (`DEV_TEAM_DATA`) inside `frontend/src/services/mockShortlist.ts`, held in a module-level in-memory object (`mockShortlistState`).
- **Search match logic** (from `mockShortlist.ts`): matches on `email`, exact `team_name`, exact `team_id`, exact `mock_token`, or `team_name` substring — all against the 5 fake records, case-insensitive.
- **Fields "returned":** whatever is on the fabricated `MockTeam` type — `team_id, team_name, team_lead, email, shortlist_status, payment_status, mock_token, payment_deadline, amount, transaction_id, paid_at`, none of which originate from Supabase.
- **`ShortlistDashboard.tsx`** (route `/shortlist/:token`) also imports `mockShortlistService.getTeamForToken(token)` from the same mock module — same situation.
- **Existing but unused real service:** `frontend/src/services/v2.ts` defines `fetchShortlistedTeams(query?)`, which does call the real, deployed `shortlisted-teams` Edge Function (GET, `?q=` param, service-role client server-side). Grep across `frontend/src` confirms **zero call sites** for `fetchShortlistedTeams` anywhere outside its own definition. It is dead code — built, deployed, never wired into any component.

**Conclusion for Part 3: Shortlist Search uses ONLY mock data. It has no connection whatsoever to `shortlisted_teams`, to the CSV import, or to Admin Payments.**

---

## 4. Database / Source-of-Truth Map

| Table/Source | Written by | Read by |
|---|---|---|
| `public.shortlisted_teams` | `import_shortlisted_teams()` RPC (CSV import); `updatePaymentNotes()` (admin notes only); payment edge functions (`payment-callback`, out of scope of this task but noted as also touching `payment_status`/`paid_at`) | `PaymentDashboard.tsx` (`listShortlistedTeams`, direct table read); `shortlisted-teams` Edge Function (public search backend — but unused by the frontend); `validate-team` Edge Function (used by `Payment.tsx`, single-team lookup, not search) |
| `public.payment_events` | payment edge functions | `PaymentDashboard.tsx` drawer only |
| `frontend/src/services/mockShortlist.ts` → `DEV_TEAM_DATA` | Hard-coded literal in source, never written by any runtime process | `ShortlistTerminal.tsx`, `ShortlistPortal.tsx`, `ShortlistDashboard.tsx` — i.e. all public-facing shortlist UI |

No `public.teams` view/table involvement in the search path (that table is only referenced for email backfill during CSV import in migration `0012`, and by `validate-team`/`Payment.tsx`, unrelated to search).

---

## 5. Payment Status Source

1. **Stored in:** `public.shortlisted_teams.payment_status` (`'PENDING' | 'FAILED' | 'PAID'`), column defined in `0007_shortlisted_teams.sql`.
2. **Source of truth table:** `shortlisted_teams` — confirmed as the only table with this column in the schema.
3. **Admin function that reads it:** `listShortlistedTeams()` (`select("*")`, so `payment_status` is included in every row `PaymentDashboard.tsx` renders).
4. **Does Shortlist Search currently have access to it?** No — it operates entirely on `mockShortlist.ts`'s fabricated `MockTeam.payment_status` field, which is not connected to the real column in any way.
5. **Does the public shortlist search currently expose real `payment_status`?** No, because it never touches the real table at all. (Separately, the `shortlisted-teams` Edge Function — which is unused — is coded to select only `team_id, team_name, team_lead_name`, so even if it were wired in, it would not expose `payment_status` today.)
6. **Is `payment_status` needed by the current shortlist search?** The mock UI's own logic (`ShortlistTerminal.tsx`'s `ResultView`) branches on `team.payment_status === "paid"` to switch the CTA between "VIEW YOUR DIGITAL PASS" and "CONFIRM YOUR SEAT — PROCEED TO PAYMENT" — so functionally, yes, the UI's own code depends on a `payment_status` field, but today it only ever comes from mock data, never from the real table.

---

## 6. Three-Way Comparison

| Workflow | Route | Component | Frontend Service | Backend | Table/Source |
|---|---|---|---|---|---|
| CSV Import | `/admin/dashboard` (Import tab) | `ShortlistImport.tsx` | `importShortlisted()` in `services/admin.ts` | RPC `import_shortlisted_teams(rows jsonb)` | `public.shortlisted_teams` |
| Admin Payments | `/admin/dashboard` (Payments tab) | `PaymentDashboard.tsx` | `listShortlistedTeams()`, `listPaymentEventsForTeam()`, `updatePaymentNotes()` in `services/admin.ts` | Direct Supabase table query (RLS: `is_admin()`) | `public.shortlisted_teams`, `public.payment_events` |
| Shortlist Search | `/` (`ShortlistPortal` section), `/shortlist/:token` | `ShortlistTerminal.tsx`, `ShortlistPortal.tsx`, `ShortlistDashboard.tsx` | `searchTeam()`, `getTeamForToken()` in `services/mockShortlist.ts` | **None — in-memory only** | `DEV_TEAM_DATA` hard-coded array (not a database) |

---

## 7. Intended vs Current Workflow

**Intended:**
```
CSV IMPORT
    ↓
[AUTHORITATIVE TEAM DATA SOURCE]
    ├──────────────→ ADMIN PAYMENTS
    └──────────────→ SHORTLIST SEARCH
```

**Current (as proven by code, not inferred):**
```
CSV IMPORT
    ↓
public.shortlisted_teams   ← authoritative, real
    │
    ├──────────────→ ADMIN PAYMENTS  ✅ connected (listShortlistedTeams reads same table)
    │
    └──────────────→ (shortlisted-teams Edge Function exists, service-role,
                       fields: team_id/team_name/team_lead_name — but NEVER CALLED)

SHORTLIST SEARCH
    ↓
services/mockShortlist.ts → DEV_TEAM_DATA (5 hard-coded fake teams)
    ↑
    completely disconnected from shortlisted_teams / CSV import
```

---

## 8. Divergences / Gaps

1. **Primary divergence:** Shortlist Search does not read from `shortlisted_teams` at all. It reads `DEV_TEAM_DATA` in `mockShortlist.ts` — a static, hand-written fixture, not persisted anywhere, not affected by CSV import in any way.
2. **A real, deployed bridge already exists and is unused:** the `shortlisted-teams` Edge Function (service-role, public, `verify_jwt=false`) and its typed frontend wrapper `fetchShortlistedTeams()` in `services/v2.ts` are fully implemented but have zero call sites in any component.
3. **Field mismatch, if ever wired up:** the `shortlisted-teams` Edge Function currently selects only `team_id, team_name, team_lead_name` — it does not select `payment_status`, `email`, `contact`, `amount`, `team_size`, etc. — so even the existing unused bridge would not, as currently coded, be sufficient to drive the "paid vs pending" CTA branch the search UI's own logic depends on.
4. **Admin Payments and CSV Import are correctly connected** — no divergence there; both operate on the same `shortlisted_teams` rows, confirmed by matching table names and column references in the actual query code, not by name similarity alone.
5. **RPC has no internal admin check** (pre-existing observation, not itself a divergence from the intended workflow): `import_shortlisted_teams()` relies solely on `GRANT EXECUTE ... to authenticated` — no `is_admin()` guard inside the function body.

---

## 9. Relevant Files

- `frontend/src/admin/ShortlistImport.tsx`
- `frontend/src/admin/PaymentDashboard.tsx`
- `frontend/src/admin/Dashboard.tsx`
- `frontend/src/services/admin.ts`
- `frontend/src/services/mockShortlist.ts`
- `frontend/src/services/v2.ts`
- `frontend/src/components/ShortlistTerminal.tsx`
- `frontend/src/components/ShortlistPortal.tsx`
- `frontend/src/pages/ShortlistDashboard.tsx`
- `frontend/src/App.tsx` (route table)
- `supabase/functions/shortlisted-teams/index.ts`
- `supabase/functions/sync-sheet/index.ts`
- `backend/database/migrations/0007_shortlisted_teams.sql`
- `backend/database/migrations/0008_payment_events.sql`
- `backend/database/migrations/0009_import_shortlisted_teams_rpc.sql`
- `backend/database/migrations/0010_grant_import_to_authenticated.sql`
- `backend/database/migrations/0011_v2_rls_policies_and_upsert.sql`
- `backend/database/migrations/0012_add_email_to_shortlisted_teams.sql`

---

## 10. Security Observations (existing behavior only, not evaluated/changed)

- No anon/public `SELECT` RLS policy exists on `shortlisted_teams` — only `admin_select_shortlisted_teams` (authenticated + `is_admin()`).
- The public `shortlisted-teams` Edge Function bypasses RLS using a **service-role client**, justified in its own source comment as necessary because no public SELECT policy exists.
- That Edge Function exposes only `team_id, team_name, team_lead_name` — it does **not** expose `payment_status`, `payment_notes`, or `paid_at`.
- `payment_notes`/`paid_at`/`payment_status` are therefore never exposed publicly by any currently-active code path (the mock data path exposes fabricated values only, not real ones).

---

## 11. Conclusion

**"From which exact source/route/function are teams currently fetched for Admin Payments, and for Shortlist Search?"**

- **Admin Payments** (`/admin/dashboard`, `PaymentDashboard.tsx`) fetches teams via `listShortlistedTeams()` → `supabase.from("shortlisted_teams").select("*")` — the real, authoritative, CSV-imported table.
- **Shortlist Search** (`/`, `ShortlistTerminal.tsx`/`ShortlistPortal.tsx`, and `/shortlist/:token`, `ShortlistDashboard.tsx`) fetches teams via `searchTeam()`/`getTeamForToken()` → `services/mockShortlist.ts` → the hard-coded `DEV_TEAM_DATA` array — not the database.

**"After CSV import, are the SAME imported team records automatically used by both systems?"**

**No.** Admin Payments automatically reflects newly-imported CSV rows (same table, live query, refetch on `lastImport` change). Shortlist Search does not — it is entirely isolated from `shortlisted_teams` and continues showing only the 5 fixed mock teams (Alpha, Beta, Gamma, Delta, Nova) regardless of any CSV import. The divergence point is exactly at `ShortlistTerminal.tsx`/`ShortlistPortal.tsx`/`ShortlistDashboard.tsx`'s import statement: `from "@/services/mockShortlist"` instead of `from "@/services/v2"` (where a working, already-deployed `fetchShortlistedTeams()` exists but is never called).

No files were modified during this investigation.
