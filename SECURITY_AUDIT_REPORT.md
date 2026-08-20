# SPECATHON 2026 Security Audit Report

**Audit date:** 2026-08-20
**Auditor:** Adversarial code/config review (static analysis + attack-path reasoning; no live traffic sent to production)
**Repository:** `D:\specathon-26` (branch: `v2-ui`, monorepo — `frontend/`, `backend/`, `supabase/`)

---

## 1. Executive Summary

**Overall security rating: CRITICAL**

The application contains at least two independent, unauthenticated paths that let any party — with no login, no valid team credentials, and no interaction with the real payment gateway — directly set any team's `payment_status` to `PAID`, and a separate unauthenticated-adjacent path that lets any *logged-in team* tamper with **any other team's** roster/fee data. Both are exercised through public Supabase Edge Functions and a `SECURITY DEFINER` RPC that is broadly grantable, not through any UI bug. The frontend's own React route guards and the RLS policy on `shortlisted_teams` are, in isolation, reasonably sound — but they only protect the PostgREST/Supabase-JS access path. The Edge Function access path bypasses both.

In addition, the codebase has **no genuine Easebuzz webhook/signature verification anywhere** — the "real" payment flow is a static, unparameterized hosted-checkout link, and reconciliation of who actually paid appears to depend entirely on a human. That is a process-security gap layered on top of the code-level bypasses.

This is not production-ready in its current state.

---

## 2. Scope

- Frontend: `frontend/src/**` (React 18 + TypeScript + Vite), all pages, hooks, services, admin dashboard
- Backend/DB: `backend/database/migrations/0001`–`0019` (canonical, ahead of `supabase/migrations/`)
- Supabase Edge Functions: `supabase/functions/{create-payment-order, payment-callback, validate-team, shortlisted-teams, provision-team-credentials, get-abstract-url, sync-sheet, upload-abstract}`
- Supabase configuration: `supabase/config.toml` (`verify_jwt` per function), `supabase/.temp/*`
- Authentication: `TeamAuthContext.tsx`, `admin/AuthContext.tsx`, `RequireAdmin.tsx`, Supabase Auth usage
- Deployment config: `vercel.json`, `frontend/index.html`
- Dependency manifests: `frontend/package.json` / `package-lock.json`, `backend/package.json`
- Git history (`git log --all`) for committed secrets
- Team Portal (`/team/login`, `/team/payment`, `/team/payment/success`, `/team/payment/failed`, spin wheel)
- Legacy/parallel flows: `/payment`, `/payment/result`, `/shortlist/:token/*` (mock-data demo flow)
- Admin dashboard (`admin/Dashboard.tsx`, `PaymentDashboard.tsx`, `SpinWheelDashboard.tsx`, `ShortlistImport.tsx`)
- Photo Booth (client-side canvas export only — no server component)

**Out of scope / not verified:** live production Supabase instance (no credentials available to this audit — all RLS/RPC conclusions are drawn from migration source files, not a live `pg_policies` query), actual Easebuzz merchant dashboard configuration, DNS/CDN/WAF layer, Vercel account-level settings not expressed in `vercel.json`.

---

## 3. Methodology

- **Full-text reconnaissance** of the repository for the keyword set specified in the audit request (`fetch(`, `supabase`, `service_role`, `payment`, `Easebuzz`, `webhook`, `RLS`, `dangerouslySetInnerHTML`, etc.) via `grep`/ripgrep across `frontend/src`, `backend/`, `supabase/`.
- **Source-level review** of every Edge Function's full implementation, every SQL migration (`0001`–`0019`), and every React page/hook that touches auth, payment, or Supabase queries.
- **Attack-path reasoning**: for each Edge Function, traced `verify_jwt` config → CORS config → auth check in code → what the handler does with `service_role`, to determine whether an unauthenticated caller can reach privileged database writes.
- **RLS policy reconstruction** by reading every `create policy` statement across migrations and cross-referencing which role (`anon`/`authenticated`/`service_role`) and which operation (`select`/`update`/`insert`) each grants, then reasoning about what a session with a given `auth.uid()` can and cannot see/change.
- **Dependency audit**: `npm audit --json` run locally against `frontend/` and `backend/` (no network calls beyond the npm registry; no code changed).
- **Git history audit**: `git log --all --diff-filter=A` and `git log --all -p` grepped for `.env` files and secret-shaped strings.
- **Safe testing only**: no requests were sent to any production/live endpoint, no real payment was attempted, no database was modified. All "can an attacker do X" conclusions are derived by reading the exact code that would execute if X were attempted, not by attempting X against a live system.

Where live-system confirmation would be needed to fully close out a finding, this report explicitly says **"NOT VERIFIED — reason."** rather than assuming pass or fail.

---

## 4. Threat Model

All nine attacker classes from the brief were considered for every finding below:

| # | Attacker | Capability assumed |
|---|---|---|
| A | Unauthenticated visitor | Can load any public page/route, call any public Edge Function |
| B | Registered team member | Has valid Team ID + password for their own team |
| C | Malicious authenticated team member | Uses their own valid session to attack other data |
| D | Team member who knows another team's Team ID | Team IDs are sequential/guessable (`SPEC2026-0001` pattern) |
| E | DevTools browser manipulator | Can edit any request before it leaves the browser |
| F | Direct API caller | Bypasses the UI entirely, calls Edge Functions / PostgREST directly with `curl`/Postman |
| G | Request-body manipulator | Can send any JSON body to any endpoint |
| H | Replay attacker | Can resend a previously observed valid request |
| I | Payment-status manipulator | Attempts to force `PENDING`/`FAILED` → `PAID` |
| J | Cross-team data harvester | Attempts to read/exfiltrate another team's PII/payment data |

The browser was treated as fully attacker-controlled throughout — no finding below relies on the attacker only interacting through the rendered UI.

---

## 5. Critical Findings

### C-01 — Unauthenticated payment-status forgery via `create-payment-order` + `payment-callback`

- **Severity:** CRITICAL
- **Affected component:** [`supabase/functions/create-payment-order/index.ts`](supabase/functions/create-payment-order/index.ts), [`supabase/functions/payment-callback/index.ts`](supabase/functions/payment-callback/index.ts), [`supabase/config.toml`](supabase/config.toml)
- **Description:** Both functions have `verify_jwt = false` in `supabase/config.toml` (lines under `[functions.create-payment-order]` and `[functions.payment-callback]`), meaning Supabase's gateway performs **no JWT/auth check at all** before invoking them — no login, no API key beyond the publicly-known anon key (which is even embedded in the shipped JS bundle) is required. Inside `payment-callback/index.ts`, the signature-verification gate is:
  ```ts
  const verified = provider.verifyWebhook(rawBody, signature);
  if (!verified && provider.name !== "dummy") {
    return json({ success: false, message: "Webhook signature verification failed." }, 401);
  }
  ```
  `getProvider()` (`supabase/functions/_shared/provider.ts`) defaults to `DummyPaymentProvider` whenever `PAYMENT_PROVIDER` is unset or unrecognized — and per its own doc comment, `dummy` is described as "current." For the dummy provider, `verified` is irrelevant: the `provider.name !== "dummy"` clause makes the entire signature check a no-op. The handler then does:
  ```ts
  await db.from("shortlisted_teams").update({ payment_status: "PAID", paid_at: new Date().toISOString() })
    .eq("id", orderEvent.shortlisted_team_id);
  ```
  using a `service_role` client (`createServiceClient()`), which bypasses RLS entirely.
- **Attack scenario:**
  1. `POST /functions/v1/create-payment-order` with `{"teamId":"SPEC2026-0001"}` (any real `team_id`, including one the attacker does not own) → returns a valid `order.id`. No auth header beyond the public anon key is required.
  2. `POST /functions/v1/payment-callback` with `{"orderId":"<id from step 1>","paymentId":"anything","status":"SUCCESS"}` → the handler marks that team `PAID` in the database, with zero real money movement and zero provider-side verification.
  3. Repeat for any/every team.
- **Evidence:** `supabase/config.toml` — `verify_jwt = false` for both functions; `supabase/functions/payment-callback/index.ts` lines ~90–100 (signature bypass logic quoted above) and the `shortlisted_teams` UPDATE using the service-role client.
- **Impact:** Complete integrity failure of the payment system. Anyone can grant themselves (or deny/corrupt another team's) confirmed-paid status, unlock the spin wheel eligibility gate that depends on it, and falsify the admin dashboard's payment records — all for ₹0.
- **Recommended remediation:** Set `verify_jwt = true` for both functions (or implement equivalent auth) and require the caller's session to match the `team_id`/`teamId` being acted on; do not accept `status: "SUCCESS"` from the browser at all — a real gateway integration must resolve success/failure server-side by calling Easebuzz's verification API with a server-held key, never trust a client-asserted status string. Until a real provider is wired in, disable/remove these functions or gate them behind `is_admin()`.

### C-02 — `import_shortlisted_teams()` grants any authenticated team write access to every team's roster/fee data

- **Severity:** CRITICAL
- **Affected component:** [`backend/database/migrations/0010_grant_import_to_authenticated.sql`](backend/database/migrations/0010_grant_import_to_authenticated.sql), function body in [`backend/database/migrations/0011_v2_rls_policies_and_upsert.sql`](backend/database/migrations/0011_v2_rls_policies_and_upsert.sql)
- **Description:** `public.import_shortlisted_teams(rows jsonb)` is `security definer` (runs with the function owner's privileges, bypassing RLS) and:
  ```sql
  grant execute on function public.import_shortlisted_teams(jsonb) to authenticated;
  ```
  Migration 0010's own comment claims this is safe because "any logged-in user whose JWT passes the `is_admin()` check can call it" — but **the function body contains no call to `is_admin()`, or any authorization check whatsoever**, in either its `0009` or `0011` version. `authenticated` is the same Postgres role every signed-in **team** account holds (team logins use the same Supabase Auth pool as admins — see `TeamAuthContext.tsx`, which only *client-side* distinguishes teams by email suffix `@teams.specathon.in`). This is a database-role check, not a client-side check — the RPC has no idea whether the caller is an admin or a team.
  The `0011` version upserts on `team_id` and unconditionally overwrites `team_name`, `team_lead_name`, `contact`, `team_size`, `amount` for **any** `team_id` supplied in the JSON payload, including teams the caller does not own.
- **Attack scenario:** A logged-in team (e.g., `TEST-002`) calls:
  ```js
  await teamSupabase.rpc('import_shortlisted_teams', {
    rows: [{ team_id: "TEST-001", registration_source: "WEBSITE", team_name: "x",
             team_lead_name: "x", contact: "x", team_size: 2, amount: 800,
             payment_status: "PENDING" }]
  });
  ```
  This overwrites `TEST-001`'s `team_name`, `team_lead_name`, `contact`, `team_size`, and `amount` — a different team's data, tampered with by an unrelated authenticated party. The same call against the caller's **own** `team_id` with `team_size: 2, amount: 800` silently downgrades their fee from whatever tier they actually registered at (e.g., 4 members / ₹1600) to the cheapest tier, since the function only checks internal consistency between the submitted `team_size` and `amount`, never the team's true membership count.
- **Evidence:** `grant execute … to authenticated` (0010); full function body (0011) has no `is_admin()` guard; `on conflict (team_id) do update set … team_size = excluded.team_size, amount = excluded.amount` unconditionally.
- **Impact:** Full write-level IDOR on the shortlist table by any team account; enables fee manipulation (underpayment) and data tampering/defacement of arbitrary other teams' roster info.
- **Recommended remediation:** Revoke `EXECUTE` from `authenticated`; grant only to `service_role` (as the original 0009 migration correctly did) or add an explicit `if not public.is_admin() then raise exception 'Forbidden'; end if;` guard inside the function body before any writes.

---

## 6. High Severity Findings

### H-01 — No real payment-provider verification exists for the "live" Easebuzz flow

- **Severity:** HIGH
- **Affected component:** [`frontend/src/pages/TeamDashboard.tsx:146,183`](frontend/src/pages/TeamDashboard.tsx), [`frontend/src/pages/TeamPaymentFailed.tsx:127`](frontend/src/pages/TeamPaymentFailed.tsx)
- **Description:** The "Proceed to Payment" / "Retry Payment" buttons in the actual Team Portal navigate to a **hardcoded, static** Easebuzz hosted-checkout URL:
  ```
  https://smartpay.easebuzz.in/164413/764b0bbbb16b4e9295588536353e7e7b
  ```
  identical for every team, every amount, every session. No `team_id`, `amount`, or callback URL is passed to Easebuzz. A repository-wide search for `SURL`, `FURL`, or any Easebuzz webhook receiver found **zero matches outside this static link string** (`grep -ril "easebuzz|SURL|FURL|smartpay"` returned only the two frontend files above and their built bundles). There is no code path anywhere that receives a callback from Easebuzz and marks `shortlisted_teams.payment_status = 'PAID'`.
- **Attack scenario / operational impact:** Since nothing in the codebase links an Easebuzz transaction to a specific team or amount, and since the amount is fixed on the Easebuzz hosted page (not passed dynamically), the system as shipped cannot programmatically know who paid what. `payment_status` for real transactions must be set by a human (an admin, presumably cross-referencing the Easebuzz merchant dashboard against `PaymentDashboard.tsx`) — this is a process control, not a code control, and it is unverifiable from source alone.
- **Evidence:** `TeamDashboard.tsx:146` and `:183`, `TeamPaymentFailed.tsx:127` — identical hardcoded URL in all three places; absence of any `SURL`/`FURL`/webhook handler in the codebase.
- **Impact:** No cryptographic binding between a real payment and the team/amount it should correspond to; reconciliation errors (wrong team marked paid, wrong amount accepted) are structurally likely and cannot be caught by the application.
- **Recommendation:** Build a real Easebuzz integration: dynamic order creation with the correct amount/team_id, a server-side webhook endpoint that verifies Easebuzz's response hash (`hash` field per Easebuzz's documented HMAC scheme) before touching `payment_status`, and SURL/FURL redirect URLs that carry a non-guessable order reference (not a `team_id` alone) validated server-side. **NOT VERIFIED** — could not confirm whether such an integration exists in an environment/branch not present in this repository checkout.

### H-02 — Public, unauthenticated Edge Functions use wildcard CORS, enabling cross-site (drive-by) exploitation

- **Severity:** HIGH
- **Affected component:** All Edge Functions' `CORS_HEADERS` (`create-payment-order`, `payment-callback`, `validate-team`, `shortlisted-teams`, `get-abstract-url`, `provision-team-credentials`)
- **Description:** Every function sets `"Access-Control-Allow-Origin": "*"`. Combined with C-01's `verify_jwt = false` on `create-payment-order`/`payment-callback`, any third-party website's JavaScript can call these endpoints against a visitor's browser with no cookie/session requirement (the anon key is a public, non-secret value bundled in the frontend and freely reusable by anyone). This means the C-01 exploit does not even require the attacker to run `curl` themselves — a malicious ad or compromised third-party page can silently execute it against any visitor.
- **Evidence:** e.g. `supabase/functions/payment-callback/index.ts` — `"Access-Control-Allow-Origin": "*"`.
- **Impact:** Removes the browser's same-origin policy as a defense-in-depth layer for an already-critical bypass; increases blast radius from "anyone with network access and a HTTP client" to "anyone who can get a victim to load a web page."
- **Recommendation:** Restrict `Access-Control-Allow-Origin` to the production frontend origin for any function that performs a privileged write. This alone does not fix C-01/C-02 (a non-browser client is unaffected by CORS), but it removes the drive-by amplification vector.

### H-03 — `xlsx` (SheetJS) dependency: Prototype Pollution + ReDoS, no fix available

- **Severity:** HIGH
- **Affected component:** `frontend/package.json` (direct dependency, used by admin export tooling — `frontend/src/admin/ExportBar.tsx` / `frontend/src/utils/exports.ts`)
- **Description:** `npm audit` reports `xlsx` as vulnerable to Prototype Pollution (GHSA-4r6h-8v6p-xvw6, CVSS 7.8) and ReDoS (GHSA-5pgg-2g8v-p4x9, CVSS 7.5), with **`fixAvailable: false`** — no patched version exists on the currently resolved version range.
- **Evidence:** `npm audit --json` output, `"xlsx": { "severity": "high", "isDirect": true, ..., "fixAvailable": false }`.
- **Impact:** If admin export functionality ever parses untrusted/attacker-influenced spreadsheet content (e.g., a CSV/XLSX re-upload flow), this is exploitable. Even if only used for read-only export of trusted internal data, the dependency remains a supply-chain risk.
- **Recommendation:** Evaluate whether `xlsx` can be replaced with a maintained alternative (e.g., `exceljs`), or pin to the SheetJS-published post-CVE build hosted outside npm (per the advisory's remediation notes) if migration isn't immediately feasible.

### H-04 — Missing security headers (CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy)

- **Severity:** HIGH
- **Affected component:** [`vercel.json`](vercel.json), [`frontend/index.html`](frontend/index.html)
- **Description:** `vercel.json` contains only an SPA rewrite rule:
  ```json
  { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
  ```
  No `headers` block is defined. `frontend/index.html`'s `<head>` contains no `<meta http-equiv="Content-Security-Policy">` or equivalent. No explicit `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, or `Permissions-Policy` is configured anywhere in the repository.
- **Evidence:** Full contents of `vercel.json` (3 lines, rewrites only); `frontend/index.html` head section has no CSP/security meta tags.
- **Impact:** No clickjacking protection (page can be framed by any origin), no CSP as a defense-in-depth layer against any future XSS, no explicit HSTS enforcement (relies entirely on host defaults, unverified).
- **Recommendation:** Add a `headers` block in `vercel.json` (or platform-equivalent) setting at minimum `X-Frame-Options: DENY`, `Content-Security-Policy` (start with a `default-src 'self'` baseline plus the Google Fonts/gtag origins already in use), `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 7. Medium Severity Findings

### M-01 — Public endpoints allow unrestricted Team ID enumeration with no rate limiting

- **Severity:** MEDIUM
- **Affected component:** `supabase/functions/validate-team/index.ts`, `supabase/functions/shortlisted-teams/index.ts`
- **Description:** Both functions are public (`verify_jwt = false`), accept an arbitrary `teamId`, and return data for any matching row with no rate limiting, CAPTCHA, or abuse detection visible anywhere in the code or `config.toml`. `validate-team` returns `team_name`, `team_lead_name`, `team_size`, and **`amount`** for any `team_id` supplied — `amount` is not one of the "three approved public fields" the `shortlisted-teams` function's own code comment describes as safe to expose, yet `validate-team` exposes it unconditionally to unauthenticated callers.
- **Evidence:** `validate-team/index.ts` — `.select("team_id, team_name, team_lead_name, team_size, amount, payment_status")` then returns `team_id, team_name, team_lead_name, team_size, amount` in the JSON response with no auth check; no rate-limiting middleware/config present.
- **Attack scenario:** Team IDs follow the pattern `SPEC2026-XXXX` (sequential per `0004_team_id_sequence.sql`). An attacker can script sequential requests to `validate-team` to harvest every team's name, lead name, size, and fee tier without authentication, and use `shortlisted-teams` (no `q`/`teamId` param) to dump the **entire shortlist** (`team_id, team_name, team_lead_name`) in one unauthenticated GET request.
- **Impact:** Bulk PII/roster disclosure (team lead names) and business data (fee amounts) exposure; enumeration also directly enables the C-01 attack (an attacker needs a real `team_id` to target — this endpoint supplies an unlimited list of them for free).
- **Recommendation:** Add rate limiting (IP-based at minimum) to both functions; remove `amount` from `validate-team`'s public response or require the caller to already be authenticated as that team.

### M-02 — Spin-wheel eligibility can be entirely bypassed while `wheel_config.current_mode = 'TEST'`

- **Severity:** MEDIUM (would be HIGH/CRITICAL if left active during the live event, since rewards have real-world value)
- **Affected component:** [`backend/database/migrations/0018_test_mode_bypasses_ticket.sql`](backend/database/migrations/0018_test_mode_bypasses_ticket.sql)
- **Description:** `execute_spin()`'s ticket/payment gating is wrapped in `if v_mode = 'LIVE' then … end if;` — in `TEST` mode, **any authenticated team with any row in `shortlisted_teams`, regardless of `payment_status` or `spin_ticket`, can spin and win a real prize.** `current_mode` is a runtime-mutable value in the `wheel_config` table (admin-editable via `SpinWheelDashboard.tsx`).
- **Evidence:** Migration 0018, section 5: `if v_mode = 'LIVE' then … [ticket checks + consumption] … end if;` — ticket checks are skipped entirely outside `LIVE` mode.
- **Impact:** If the event operator forgets to flip `current_mode` to `LIVE` (or flips it back to `TEST` for any reason during the live event, e.g. troubleshooting), every authenticated team — paid or not — can spin and claim real prizes.
- **Recommendation:** This is a legitimate testing feature but is a serious foot-gun. Add a dashboard warning/confirmation when `current_mode = 'TEST'` and `is_enabled = true` simultaneously, and audit-log every mode change.

### M-03 — `issue_spin_ticket()` is defined and locked down, but never invoked anywhere in the codebase

- **Severity:** MEDIUM
- **Affected component:** `backend/database/migrations/0016_spin_ticket_schema.sql`, `0017_protect_issue_spin_ticket.sql`
- **Description:** Since migration 0016, spin eligibility in `LIVE` mode is gated by `shortlisted_teams.spin_ticket` (`NOT_ISSUED → AVAILABLE → USED`), not directly by `payment_status`. `issue_spin_ticket()` is the only function that can move a team from `NOT_ISSUED` to `AVAILABLE`, and its `EXECUTE` grant is restricted to `service_role` only (0017 — correctly locked down). However, a repository-wide search (`grep -r "issue_spin_ticket"`) found **no caller** of this function anywhere in `frontend/src`, `supabase/functions/*`, or any migration/trigger. `SpinWheelDashboard.tsx` (admin UI) does not reference `spin_ticket` or `issue_spin_ticket` at all.
- **Evidence:** Grep for `issue_spin_ticket` across the entire repo returns only its own definition/grant migrations — zero call sites.
- **Impact:** As shipped, there appears to be no automated path that ever issues a spin ticket in `LIVE` mode, meaning the intended "pay → ticket issued → can spin" flow is incomplete. This is a functional gap more than a pure vulnerability, but it directly affects the security posture of M-02: if the real gating mechanism is unreachable, `TEST` mode (which has no gating at all) becomes the only way the feature can function in practice, which is the worst-case configuration from a security standpoint.
- **Recommendation:** Wire `issue_spin_ticket()` into the real payment-confirmation path (once H-01 is fixed with a genuine webhook), or into an explicit admin action, before the event goes live. **NOT VERIFIED** — could not query the live database to confirm whether tickets are being issued via a mechanism not present in this repository (e.g., manual SQL run by an operator).

### M-04 — Internal Supabase project metadata committed to git

- **Severity:** MEDIUM (informational leak, not a credential leak)
- **Affected component:** `supabase/.temp/linked-project.json`, `supabase/.temp/pooler-url`, `supabase/.temp/project-ref`
- **Description:** `supabase/.temp/*` (Supabase CLI local state, normally ephemeral/gitignored) is tracked in git. `git ls-files supabase/.temp` confirms all 9 files are committed. `linked-project.json` discloses the Supabase organization ID and project name; `pooler-url` discloses the full Postgres connection-pooler hostname (`postgresql://postgres.promrefgpjrgumbugqht@aws-1-ap-south-1.pooler.supabase.com:5432/postgres` — no password present). The project ref itself is not newly sensitive (it is already derivable from the public anon-key JWT's `ref` claim), but the organization ID and pooler hostname are additional internal infrastructure detail that should not be in version control.
- **Evidence:** `git ls-files supabase/.temp` output (9 tracked files); file contents read directly.
- **Impact:** Low direct exploitability (no credentials), but unnecessary infrastructure fingerprinting for an attacker, and indicates `.gitignore` coverage is incomplete (no `supabase/.gitignore` or root-level `supabase/.temp` entry exists).
- **Recommendation:** Add `supabase/.temp/` to `.gitignore`, `git rm -r --cached supabase/.temp`, and rotate nothing-sensitive-here but tighten process going forward.

### M-05 — `npm audit`: 7 high + 6 moderate vulnerabilities in frontend dependency tree

- **Severity:** MEDIUM (aggregate; see H-03 for the one HIGH item with no fix)
- **Affected component:** `frontend/package-lock.json`
- **Description:** Full `npm audit --json` results (frontend): **13 total** (7 high, 6 moderate, 0 critical, 0 low). Vulnerable packages: `xlsx` (high, no fix — see H-03), `undici` (high, fixable), `brace-expansion` (high, fixable), `fast-uri` (high, fixable), `ip-address` (high, fixable), `js-yaml` (high, fixable), `nanoid` (high, fixable), `react-router` / `react-router-dom` (moderate, fixable — **direct production dependency**), `dompurify` (moderate, fixable), `postcss` (moderate, fixable), `hono` / `@hono/node-server` (moderate, fixable). Backend (`backend/package.json`) has a single devDependency (`@supabase/supabase-js`) and its own `npm audit` reported 0 vulnerabilities against that dependency directly; however, the dependency-count figures returned in that run were identical to the frontend run, which is unexpected and could not be conclusively explained from this environment — flagged as **NOT VERIFIED** (possible shared/hoisted lockfile resolution or workspace artifact; recommend re-running `npm audit` in a clean `backend/`-only install to confirm).
- **Evidence:** `npm audit --json` full output captured during this audit.
- **Impact:** Most of these are transitive/build-tooling dependencies with lower runtime exposure, but `react-router-dom` is a direct, always-loaded production dependency, and `dompurify` (used transitively, likely via `html2canvas` used in Photo Booth export tooling) handling any untrusted HTML would be directly relevant to XSS risk.
- **Recommendation:** Run `npm audit fix` for the fixable items in a branch, verify no breaking changes, and separately plan the `xlsx` replacement (H-03). Re-run `npm audit` for `backend/` in isolation to resolve the anomalous dependency count.

---

## 8. Low Severity Findings

### L-01 — Legacy demo/mock payment flow shipped to production routing

- **Severity:** LOW
- **Affected component:** `frontend/src/pages/{ShortlistRecovery,ShortlistDashboard,ShortlistPayment,ShortlistConfirmation,ShortlistReceipt}.tsx`, `frontend/src/services/mockShortlist.ts`
- **Description:** The `/shortlist/:token`, `/shortlist/:token/payment`, `/shortlist/:token/confirmation`, `/shortlist/:token/receipt`, and `/shortlist/recover` routes are live in `App.tsx` but are backed entirely by hardcoded, client-side mock data (`DEV_TEAM_DATA` in `mockShortlist.ts`) — no real Supabase call is made. This is confirmed dead-relative-to-real-data code shipped and reachable in production.
- **Evidence:** `mockShortlist.ts` — `DEV_TEAM_DATA: MockTeam[]` with hardcoded fake teams (`SPC2026-001`, `Team Alpha`, etc.); `ShortlistRecovery.tsx` calls `getMockRecoveryUrl`/`mockDevLinks`, not any API.
- **Impact:** No real data exposure (all data is fake), but unprofessional/confusing surface area shipped to production, and unnecessary bundle size / attack surface for future regressions if someone later wires it to real data without re-reviewing it.
- **Recommendation:** Remove these routes/pages before production launch, or clearly gate them behind a dev-only build flag.

### L-02 — Similarly dead-but-live `create-payment-order`/`payment-callback`/`validate-team` UI (`Payment.tsx`, `PaymentResult.tsx`) is not routed, but its backing Edge Functions remain callable

- **Severity:** LOW (as a UI observation) — see **C-01** for the actual severity of the underlying Edge Functions
- **Affected component:** `frontend/src/pages/Payment.tsx`, `frontend/src/pages/PaymentResult.tsx`, `frontend/src/App.tsx`
- **Description:** `Payment.tsx` and `PaymentResult.tsx` are not registered in `App.tsx`'s `<Routes>` — they are unreachable via normal navigation. `PaymentResult.tsx` is explicitly documented in its own header comment as "Purely presentational... No API calls," so it does not itself elevate privilege. However, this page's existence (and its dummy-gateway UI in `Payment.tsx`) confirms the `create-payment-order`/`payment-callback`/`validate-team` Edge Functions were built for, and exercised by, this now-orphaned flow — and remain fully live and callable directly regardless of the frontend routing.
- **Evidence:** `App.tsx` route list (no `/payment` or `/payment/result` entries); `PaymentResult.tsx` line 10 comment.
- **Recommendation:** Either delete this dead code or, if kept for future use, ensure it is not shipped in the production bundle. This does not reduce the severity of C-01 — the Edge Functions must be fixed regardless of whether any UI links to them.

### L-03 — Team-password suffix is a constant, predictable string

- **Severity:** LOW
- **Affected component:** `supabase/functions/provision-team-credentials/index.ts`
- **Description:** `generateSecurePassword()` produces a 16-character random alphanumeric prefix from `crypto.getRandomValues` (cryptographically strong) but always appends the literal constant `"aA1!"`:
  ```ts
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "aA1!";
  ```
- **Evidence:** Function body, final return statement.
- **Impact:** Minimal on its own (the random prefix dominates entropy), but every team's password shares an identical, predictable 4-character suffix, which is unnecessary information for an attacker attempting credential-stuffing or pattern-based guessing, and is poor practice regardless of practical exploitability here.
- **Recommendation:** Generate the full password length randomly rather than appending a fixed suffix (the suffix appears intended only to satisfy a password-complexity rule — use guaranteed-random character-class insertion instead).

### L-04 — Raw Supabase/Postgrest error messages surfaced to end users

- **Severity:** LOW
- **Affected component:** `frontend/src/pages/TeamPaymentSuccess.tsx`
- **Description:** Fetch errors are captured and rendered close to verbatim:
  ```ts
  const msg = (err as { message?: string })?.message ?? String(err);
  setFetchError(msg);
  ```
  then displayed as `Failed to load payment data: {fetchError}`. During earlier development this surfaced raw Postgrest errors like `column shortlisted_teams.email does not exist` directly in the UI.
- **Impact:** Minor internal schema/implementation detail disclosure to the user experiencing the error (not to arbitrary third parties) — low severity, but inconsistent with the pattern used elsewhere in the codebase (e.g., Edge Functions correctly return generic messages and log details server-side only).
- **Recommendation:** Map known error shapes to friendly messages and log the raw error to a monitoring service instead of rendering it.

### L-05 — No rate limiting / lockout observed on Team or Admin login

- **Severity:** LOW (Supabase Auth applies some default platform-level throttling, but nothing custom is implemented in this codebase)
- **Affected component:** `TeamAuthContext.tsx` (`signInTeam`), `admin/AuthContext.tsx` (`signIn`)
- **Description:** Both call `supabase.auth.signInWithPassword()` directly with no application-level attempt counting, lockout, or CAPTCHA. **NOT VERIFIED** — Supabase's platform-level auth rate limiting was not inspected (requires dashboard access not available to this audit), so this is a code-level observation only, not a confirmed live vulnerability.
- **Recommendation:** Confirm Supabase project auth rate-limit settings are enabled; consider adding a client-side backoff and, if brute-force is a concern given team-ID predictability (M-01), a CAPTCHA after N failed attempts.

---

## 9. Authentication & Authorization

| Control | Result | Notes |
|---|---|---|
| Team session isolated from admin session (separate storage keys) | **PASS** | `teamSupabase` uses `storageKey: "specathon-team-auth"`, admin `supabase` uses `"specathon-admin-auth"` (`services/supabase.ts`) — prevents session confusion between the two dashboards in the same browser. |
| Client-side route guards exist for protected pages | **PASS** (but see below) | `TeamDashboard.tsx`, `TeamPaymentSuccess.tsx`, etc. all check `if (!session || !isTeam) return <Navigate to="/team/login" />`. |
| Client-side route guards are sufficient on their own | **FAIL (by design of the threat model)** | Route guards are cosmetic; the real boundary must be — and for the *Supabase-JS query path* actually is — enforced server-side via RLS. Confirmed independently below. |
| Backend independently authorizes team data reads (RLS) | **PASS** (for the Supabase-JS/PostgREST path only) | `teams_view_own_record` policy: `using (auth.uid() = auth_id)` (`0013_team_auth_association.sql`) — enforced at the Postgres level regardless of what the frontend requests. |
| Backend independently authorizes payment-status writes | **FAIL** | See **C-01** — the Edge Function path bypasses RLS entirely via `service_role`, and has no independent authorization check of its own. |
| Backend independently authorizes shortlist-data writes | **FAIL** | See **C-02** — `import_shortlisted_teams()` is `SECURITY DEFINER` with no internal authorization check, granted to the broad `authenticated` role. |
| Passwords stored securely | **PASS** | Supabase Auth (GoTrue) stores only salted/hashed credentials; no password is ever stored in `shortlisted_teams` or any application table. |
| Passwords/credentials returned by APIs | **PARTIAL** | `provision-team-credentials` returns the freshly-generated plaintext password in its JSON response — this is **necessary and expected** for a credential-provisioning flow (the admin must relay it to the team once), and the endpoint is itself correctly admin-gated (see §13). Not a finding on its own. |
| Logout invalidates session | **PASS** | `signOutTeam()`/`signOut()` call `supabase.auth.signOut()`, which revokes the refresh token server-side (standard Supabase Auth behavior), then hard-redirects and replaces browser history. |
| Protected routes reachable via direct URL entry without a session | **FAIL only in the demo-data sense** | `/team/payment` etc. correctly redirect unauthenticated visitors to `/team/login` (client-side check backed by RLS for data). The mock `/shortlist/:token/*` routes (L-01) are reachable with no auth at all, but serve only fake data. |

---

## 10. IDOR / BOLA Testing

**Explicit question: Can `TEST-002` access `TEST-001` data?**

This has two different answers depending on the access path:

1. **Via the authenticated Supabase-JS client (the path the actual Team Portal UI uses):** **NO — PASS.** The `teams_view_own_record` RLS policy (`auth.uid() = auth_id`) is enforced by Postgres regardless of any `.eq("team_id", …)` filter (or lack thereof) in the application code, so a session authenticated as `TEST-002` can only ever have rows matching `TEST-002`'s `auth_id` returned, full stop. (This also means a *previously reported* bug where `TEST-002` saw `TEST-001`'s data via a `.single()` query with no team filter cannot be explained by an RLS gap under the current migrations — if it occurred, the more likely cause was stale client-side/local-storage session state carried over between two different team logins in the same browser tab, not a server-side authorization failure. **NOT VERIFIED** — could not reproduce or confirm root cause without live session testing.)
2. **Via direct/unauthenticated Edge Function calls (a path outside the UI's control):** **YES — FAIL**, in two distinct ways:
   - **Read:** `validate-team` and `shortlisted-teams` are intentionally public lookup endpoints (part of the product's design — public shortlist search) and will return `TEST-001`'s `team_name`, `team_lead_name`, `team_size`, and (for `validate-team` specifically) `amount` to anyone who asks, including `TEST-002`'s logged-in user, an unauthenticated visitor, or an anonymous script. **This is partially "by design"** for the shortlist-lookup feature, but `amount` exposure in `validate-team` was not called out as an approved public field anywhere in the code comments (which explicitly enumerate the "three approved public fields" as `team_id, team_name, team_lead_name` for `shortlisted-teams` only) — see **M-01**.
   - **Write:** `TEST-002` (or anyone with any `authenticated`-role session) can call `import_shortlisted_teams` to overwrite `TEST-001`'s `team_name`, `team_lead_name`, `contact`, `team_size`, and `amount` — see **C-02**. `TEST-002` (or anyone at all, no session needed) can also flip `TEST-001`'s `payment_status` to `PAID` via `create-payment-order` + `payment-callback` — see **C-01**.

**Bottom line:** the RLS-protected read path is sound; the Edge-Function write paths are not, and they are the more severe half of this question since they involve unauthorized *writes* to another team's payment and roster data, not just reads.

---

## 11. Payment Gateway Security

| Aspect | Finding |
|---|---|
| Payment creation | `create-payment-order` looks up the team's `amount` server-side from `shortlisted_teams` (not client-supplied) — **amount cannot be directly manipulated via the request body** for this specific function. **PASS** for that narrow claim. |
| Amount integrity (real/Easebuzz flow) | **NOT VERIFIED / likely FAIL** — the static Easebuzz hosted-checkout link (H-01) carries no `team_id` or `amount` parameter at all; the gateway-side amount is presumably fixed on Easebuzz's dashboard configuration, outside this codebase's control, and cannot be confirmed to match each team's actual tiered fee (₹800/₹1200/₹1600) from source alone. |
| Callback/webhook signature verification | **FAIL** — see **C-01**. The only "verification" logic present unconditionally passes for the active (`dummy`) provider. No real Easebuzz HMAC verification exists anywhere in the repository. |
| Replay protection | **PARTIAL PASS** for the dummy-provider flow specifically: `payment-callback` has an idempotency guard — `if (team.payment_status === "PAID") { … return json({ success: true }); }` — so replaying an *already-successful* callback for an *already-PAID* team is a no-op, not a double-charge/double-event. However, this does not prevent the *first* forged callback (C-01) from succeeding, and provides no protection at all for the real Easebuzz flow, which has no callback handler to replay against in the first place. |
| Payment-status direct manipulation via Supabase client | **PASS** — no RLS `update` policy grants `authenticated`/team-owner write access to `shortlisted_teams`; only `admin_update_shortlisted_teams` (`is_admin()`-gated) and `service_role` can write. A team cannot `PATCH` their own `payment_status` via the anon-key REST API directly. |
| Payment-status manipulation via Edge Function | **FAIL** — see **C-01**, which bypasses the above RLS protection entirely via `service_role`. |
| Team/payment ownership binding | **FAIL** for the dummy-flow — `payment-callback` binds a callback only to the `orderId` created in a prior `create-payment-order` call, and that call accepts *any* `teamId` string with no ownership check against the caller (there is no caller identity to check, since `verify_jwt = false`). Any party can create an order for, and then "pay," any team. |
| Duplicate payment handling | Idempotency guard described above prevents duplicate `PAYMENT_SUCCESS` events/status flips for an already-PAID team, but nothing stops an attacker from calling `create-payment-order` repeatedly for a still-`PENDING` team (each call inserts a fresh `ORDER_CREATED` payment_events row) — low-impact log/data noise, not a financial risk beyond C-01 itself. |
| Success-page authorization semantics | `/team/payment/success` ([`TeamPaymentSuccess.tsx`](frontend/src/pages/TeamPaymentSuccess.tsx)) **does** independently re-query `shortlisted_teams.payment_status` from the database on load rather than trusting a URL parameter or redirect-only signal — this is the *correct* pattern (**"the backend independently verified," not "the gateway redirected here"**) **for what it displays**. The flaw is *upstream* of this page: because `payment_status` itself can be forged (C-01) or is only reconciled by a human (H-01), the page correctly reflects the database, but the database's trustworthiness is what's compromised. The legacy `PaymentResult.tsx` (unrouted, L-02) is explicitly the *bad* pattern ("gateway redirected here," no verification) but is not reachable in production routing. |

---

## 12. Supabase Security

- **RLS enabled** on `shortlisted_teams`, `payment_events`, `wheel_config`, `spin_attempts`, `teams`, `team_members`, `admins`, `audit_log` — confirmed via `alter table … enable row level security` in every relevant migration. **PASS.**
- **Anonymous (`anon`) SELECT access:** No table grants direct `SELECT` to `anon` for any sensitive table (`teams`/`team_members` explicitly `revoke all … from anon` in `0001`). All public data access goes through `SECURITY DEFINER` RPCs/Edge Functions with service-role, which is the correct pattern *in principle* — the flaw is those RPCs/functions themselves lacking authorization checks (C-01, C-02), not the RLS/anon boundary.
- **Authenticated (team) SELECT on other teams:** Blocked by `teams_view_own_record` (`auth.uid() = auth_id`). **PASS**, per §10.
- **Authenticated (team) UPDATE on `shortlisted_teams` (any row, including own):** No such policy exists — only `admin_update_shortlisted_teams` (admin-gated). **PASS** for the direct-table path; **FAIL** via `import_shortlisted_teams` RPC (C-02).
- **Authenticated (team) INSERT into `shortlisted_teams`:** No INSERT policy for `authenticated` exists on the table itself. **FAIL** via the `import_shortlisted_teams` RPC, which is `SECURITY DEFINER` and thus not subject to the table's RLS at all (C-02).
- **`payment_events` (audit log):** Only `admin_select_payment_events` exists (`select`, `is_admin()`-gated) — no `update`/`delete` policy is ever granted to any non-service role, consistent with its documented append-only design. **PASS.**
- **`service_role` key exposure:** Searched the entire frontend bundle source and `frontend/.env` — only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (JWT payload decodes to `"role":"anon"`) are present; **no service-role key found in frontend code, `.env`, or git history.** **PASS.**
- **`SUPABASE_SERVICE_ROLE_KEY` usage:** Confined to Edge Functions (`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`), which is the correct place for it to live (server-side only, not shipped to the browser). **PASS** on placement; the problem is *authorization checks around its use*, not its exposure (C-01, C-02).

---

## 13. Edge Functions / APIs

| Function | `verify_jwt` | Own auth check in code | CORS | Trusts client-supplied values that matter | Verdict |
|---|---|---|---|---|---|
| `create-payment-order` | `false` | None | `*` | `teamId` (arbitrary, no ownership check) | **FAIL** — C-01 |
| `payment-callback` | `false` | Signature check unconditionally bypassed for the active `dummy` provider | `*` | `orderId`, `status` (client asserts success/failure directly) | **FAIL** — C-01 |
| `validate-team` | `false` | None (intentionally public lookup) | `*` | `teamId` (by design, but leaks `amount` — M-01) | **PARTIAL** |
| `shortlisted-teams` | `false` | None (intentionally public lookup, minimal fields) | `*` | `teamId`/`q` (by design; fields are deliberately minimal per code comments) | **PASS** (as designed) with **M-01** rate-limiting caveat |
| `provision-team-credentials` | not applicable (function checks manually) | Explicit `is_admin()` check via caller's own JWT before any privileged action; atomic race-condition-safe binding | `*` | `teamId` only, post-auth | **PASS** |
| `get-abstract-url` | `true` | Explicit `is_admin()` check via caller's own JWT; short-TTL (600s) presigned R2 URLs; R2 credentials never returned to client | `*` (but `verify_jwt=true` means Supabase's gateway already requires a valid JWT before the handler runs at all) | `teamId`, post-auth | **PASS** |
| `sync-sheet` | `true` | Not read in depth (out of primary payment/auth scope); gateway-level JWT required | n/a | — | **NOT VERIFIED** — not read in full during this audit |
| `upload-abstract` | `false` | Not read in depth | n/a | — | **NOT VERIFIED** — not read in full during this audit; `verify_jwt=false` on a file-upload endpoint warrants a follow-up review even though it is out of the payment/auth critical path |

CORS is `*` on every function including the well-protected ones (`get-abstract-url`, `provision-team-credentials`) — for those two, `verify_jwt`/explicit admin checks mean CORS wildcarding doesn't enable unauthorized access (an attacker's page still can't forge a valid admin JWT), but it's still unnecessarily permissive and should be tightened as defense-in-depth (H-02 recommendation applies here too, lower priority for these two).

---

## 14. Spin Wheel / Reward Security

- **Reward determined server-side:** **PASS.** `execute_spin()` (`0018`, latest version) computes `v_result` inside a `plpgsql` function using Postgres's own `random()`, after the client has already committed to calling the RPC — the client never sends, and cannot influence, which prize is chosen.
- **Result cannot be forged/replayed from the browser:** **PASS.** The function is `SECURITY DEFINER`, requires `auth.uid()` to resolve to a real session, and the RPC signature takes no result-shaping parameters at all — there is nothing in the request for DevTools to tamper with.
- **One spin per team enforced atomically:** **PASS.** `create unique index spin_attempts_team_idx on public.spin_attempts(shortlisted_team_id)` (`0015`) plus the `for update` row lock on `wheel_config` during the transaction serializes concurrent spin attempts — a double-submit race cannot produce two recorded spins for one team.
- **One winner per prize tier enforced atomically:** **PASS.** `spin_attempts_prize_1_mode_idx`/`_prize_2_mode_idx` partial unique indexes (`0014`) plus the probability calculation checking `v_prize_1_taken`/`v_prize_2_taken` before weighting prevent two teams from both winning the same "PRIZE_1"/"PRIZE_2" slot.
- **Eligibility gating (payment → ticket → spin):** **FAIL/INCOMPLETE**, per **M-02** (TEST-mode bypass) and **M-03** (no code path ever calls `issue_spin_ticket()`). The *mechanism* for secure gating exists and is well-built, but its trigger appears to be missing or entirely manual, and the TEST-mode override removes the gate altogether.
- **Reward has real-world value → severity classification:** Per the audit brief's instruction, M-02 is elevated to a MEDIUM-with-HIGH/CRITICAL-conditional-severity finding rather than a plain LOW misconfiguration note, since an operator mistake here directly translates to real prizes being given away for free.

---

## 15. Frontend Security

- **`dangerouslySetInnerHTML` / `innerHTML` / `insertAdjacentHTML` / `eval(` / `new Function(`:** Zero matches across `frontend/src` (verified by direct grep). **PASS.**
- **URL parameters rendered into HTML:** `PaymentResult.tsx` reads `status`/`team` from `useSearchParams()` and renders `teamId` as text content inside JSX (`{teamId}`), which React escapes by default — no raw HTML injection path. **PASS.** (This page is also unrouted — L-02.)
- **`localStorage`/`sessionStorage`/`document.cookie` direct manipulation:** No direct application code touches these APIs; Supabase Auth manages its own `localStorage` persistence internally via the `storageKey` option, which is the standard, supported pattern. **PASS.**
- **Open redirects:** Every `window.location.href`/`window.location.replace` call site uses a hardcoded literal string (the Easebuzz URL, `/team/login`, `/admin/login`) — none are derived from a URL parameter or other user-controlled input. **PASS.**
- **`javascript:` URLs / attacker-controlled redirect destinations:** None found. **PASS.**

---

## 16. Secrets

| Item | Status |
|---|---|
| `VITE_SUPABASE_ANON_KEY` in `frontend/.env` and shipped bundle | **SAFE PUBLIC VALUE** — this key is explicitly designed by Supabase to be public; JWT payload decodes to `role: "anon"`. Not a finding. |
| `SUPABASE_URL` in `frontend/.env` | **SAFE PUBLIC VALUE** — a project's REST API base URL is not secret. |
| `SUPABASE_SERVICE_ROLE_KEY` | **NOT FOUND in frontend code, `.env`, git history, or built `dist/` bundle.** Correctly referenced only via `Deno.env.get(...)` inside Edge Functions (server-side secret store). **PASS.** |
| Easebuzz merchant key/salt, webhook secret | **NOT FOUND anywhere in the repository** — consistent with H-01's finding that no real Easebuzz integration exists in code at all. Cannot assess exposure of a secret that isn't present; also cannot confirm it's safely stored elsewhere (out of scope — lives in Easebuzz/Vercel/Supabase dashboards if it exists at all). |
| R2 (Cloudflare) access key / secret / endpoint | Referenced only via `Deno.env.get("R2_ACCESS_KEY_ID"/"R2_SECRET_ACCESS_KEY"/"R2_ENDPOINT")` inside `get-abstract-url`, never returned to the client, never committed. **PASS.** |
| `.env`/`.env.local` files tracked in git (current or historical) | **NONE FOUND.** `git log --all --diff-filter=A --name-only` shows only `.env.example` (template, no real values) was ever added; actual `.env` files are correctly `.gitignore`d at both root and `frontend/`/`backend/` level. **PASS.** |
| `supabase/.temp/*` infra metadata | **COMMITTED** — see **M-04**. No credentials, but org ID + pooler hostname disclosed. |

---

## 17. Dependency Audit

**Frontend (`npm audit --json`):**

```
info: 0, low: 0, moderate: 6, high: 7, critical: 0 — 13 total
```

High: `xlsx` (no fix — H-03), `undici`, `brace-expansion`, `fast-uri`, `ip-address`, `js-yaml`, `nanoid` (all fixable via `npm audit fix`).
Moderate: `react-router` / `react-router-dom` (direct dependency), `dompurify`, `postcss`, `hono`, `@hono/node-server` (all fixable).

**Backend (`npm audit --json`):** Reported 0 vulnerabilities, but the returned dependency-count metadata was identical to the frontend run's, which is unexpected given `backend/package.json` lists a single devDependency. **NOT VERIFIED** — recommend re-running in a clean, isolated `backend/` install to confirm this wasn't an artifact of shared tooling/cache in this environment.

No dependency changes were made during this audit, per the audit's scope restriction.

---

## 18. Security Headers

| Header | Status |
|---|---|
| HTTPS enforced | **NOT VERIFIED from source** — Vercel enforces HTTPS by default at the platform level, but no explicit HSTS is configured to guarantee this (see below). |
| `Strict-Transport-Security` | **MISSING** — not set in `vercel.json` or anywhere else. |
| `Content-Security-Policy` | **MISSING** — no CSP meta tag or header configured anywhere. |
| `X-Frame-Options` / `frame-ancestors` | **MISSING** |
| `X-Content-Type-Options` | **MISSING** |
| `Referrer-Policy` | **MISSING** |
| `Permissions-Policy` | **MISSING** |
| CORS (application-level, not Edge Functions) | Frontend is a static SPA; no application-level CORS config beyond the Edge Functions covered in §13/H-02. |

See **H-04** for full detail and remediation.

---

## 19. Business Logic Security

- **"If I own TEST-002 but know TEST-001's Team ID, what can I do?"** — Read TEST-001's `team_name`, `team_lead_name`, `team_size`, `amount` via `validate-team` (M-01); overwrite TEST-001's `team_name`, `team_lead_name`, `contact`, `team_size`, `amount` via `import_shortlisted_teams` (C-02); flip TEST-001's `payment_status` to `PAID` via `create-payment-order`+`payment-callback` (C-01) — all without ever needing TEST-001's password, and the last two without needing to be authenticated as TEST-002 (or anyone) at all.
- **"If I don't use the website UI at all and directly call the backend, what can I do?"** — Everything in C-01 and M-01 requires no authentication whatsoever (`verify_jwt = false`, public anon key only). C-02 requires only *some* valid `authenticated` session (any team's own real credentials, or an admin's) — it does not require being an admin specifically, which is the core of that finding.
- **Duplicate transactions / replayed requests:** The dummy-provider idempotency guard (§11) prevents a *replayed already-successful* callback from creating duplicate `PAYMENT_SUCCESS` events for an already-`PAID` team, but does not prevent the *original* forgery (C-01) from succeeding in the first place, nor does anything prevent an attacker from creating unlimited `ORDER_CREATED` audit-log noise via repeated `create-payment-order` calls for a `PENDING` team.
- **Unauthorized navigation:** All genuinely sensitive pages (`/team/payment*`, `/admin/dashboard`) correctly gate on `session`/`isAdmin`/`isTeam` state before rendering data, and the underlying data fetch is independently RLS-protected for the *read* path (§9, §10). The gap is exclusively in the Edge Function *write* paths, not in page-level access control.

---

## 20. Attack Matrix

| Attack | Tested | Result | Severity |
|---|---|---|---|
| TEST-002 → TEST-001 read access (via authenticated Supabase-JS client) | Yes (code/RLS review) | **PASS** — RLS blocks it | — |
| TEST-002 → TEST-001 read access (via public `validate-team`/`shortlisted-teams`) | Yes (code review) | **FAIL** — limited fields (name/lead/size/amount), by-design public lookup but under-scoped for `amount` | MEDIUM (M-01) |
| TEST-002 → TEST-001 write access (`import_shortlisted_teams`) | Yes (code review) | **FAIL** | CRITICAL (C-02) |
| Amount manipulation at order-creation time | Yes (code review) | **PASS** for `create-payment-order` itself (amount sourced server-side from DB) | — |
| Amount manipulation via `import_shortlisted_teams` (fee-tier downgrade) | Yes (code review) | **FAIL** | CRITICAL (C-02) |
| Payment success forgery (navigate directly to success page) | Yes (code review) | **PASS** — `TeamPaymentSuccess.tsx` re-queries real DB state, doesn't trust the URL | — |
| Payment success forgery (forge the underlying DB state via Edge Function) | Yes (code review) | **FAIL** | CRITICAL (C-01) |
| Payment callback signature/hash verification | Yes (code review) | **FAIL** — unconditionally bypassed for active `dummy` provider | CRITICAL (C-01) |
| Payment replay (resend an already-successful callback) | Yes (code review) | **PASS** — idempotency guard present | — |
| Payment status direct manipulation via Supabase REST/RLS | Yes (code review) | **PASS** — no team-owner UPDATE policy exists | — |
| Payment status manipulation via Edge Function | Yes (code review) | **FAIL** | CRITICAL (C-01) |
| Spin result manipulation from the browser | Yes (code review) | **PASS** — server-computed, no client-influenceable parameters | — |
| Spin replay (double-spin) | Yes (code review) | **PASS** — unique index + row lock | — |
| Spin eligibility bypass via TEST mode | Yes (code review) | **FAIL** (conditional on operator config) | MEDIUM (M-02) |
| Team ID enumeration | Yes (code review) | **FAIL** — no rate limiting on public lookup endpoints | MEDIUM (M-01) |
| XSS via `dangerouslySetInnerHTML`/`innerHTML`/`eval` | Yes (repo-wide grep) | **PASS** — none found | — |
| Open redirect | Yes (code review) | **PASS** — all redirect targets hardcoded | — |
| Service-role key exposure to browser | Yes (repo + bundle + git history search) | **PASS** — not found | — |
| Secrets committed to git history | Yes (`git log --all -p` search) | **PASS** — no real `.env`/secret values found; only non-sensitive infra metadata (M-04) | LOW–MEDIUM (M-04) |
| Admin privilege escalation (self-granting `admins` row) | Yes (RLS review) | **PASS** — no INSERT policy for `authenticated` on `admins`; only `service_role` inserts (manual provisioning) | — |

---

## 21. Remediation Priority

**P0 — Fix immediately (before any further use, including further testing with real credentials):**
- C-01: Require real authentication/authorization on `create-payment-order` and `payment-callback`, and never trust a client-asserted `status: "SUCCESS"` — resolve payment outcome server-side against the real provider.
- C-02: Revoke `EXECUTE` on `import_shortlisted_teams` from `authenticated`; restrict to `service_role` or add an internal `is_admin()` guard.

**P1 — Fix before production/launch:**
- H-01: Build and wire in genuine Easebuzz webhook verification (HMAC/hash check) with dynamic, per-team order amounts; retire the static hosted-checkout link.
- H-02: Restrict CORS on all privileged Edge Functions to the production origin.
- M-01: Add rate limiting to `validate-team`/`shortlisted-teams`; remove `amount` from `validate-team`'s public response or gate it.
- M-02 / M-03: Confirm/lock `wheel_config.current_mode = 'LIVE'` before the event and wire `issue_spin_ticket()` into the real payment-confirmation path.
- H-04: Add CSP, X-Frame-Options, HSTS, and related headers.

**P2 — Fix soon:**
- H-03 / M-05: Replace or pin `xlsx`; run `npm audit fix` for the remaining fixable advisories.
- M-04: Remove `supabase/.temp/` from git tracking.
- L-01 / L-02: Remove or gate dead demo/legacy routes and their unrouted pages.

**P3 — Hardening:**
- L-03: Remove the fixed password suffix.
- L-04: Sanitize user-facing error messages.
- L-05: Confirm/add auth rate limiting and consider CAPTCHA given M-01.

---

## 22. Production Security Checklist

- [ ] **Authentication** — Team/Admin login functional and correctly separated (storage keys) — **already PASS**; add rate limiting (L-05).
- [ ] **Authorization** — Close C-01 and C-02 before considering this control met; RLS on `shortlisted_teams` reads is otherwise sound.
- [ ] **RLS** — Confirm live production database's actual policies match these migrations exactly (**NOT VERIFIED live** — this audit read source files only).
- [ ] **Payment verification** — Build real Easebuzz webhook + signature verification (H-01); remove/lock down the dummy provider path (C-01) before go-live.
- [ ] **Webhook security** — No real webhook exists yet to secure; must be built with HMAC verification, not trusted client status.
- [ ] **Secrets** — Currently clean (no leaks found); keep `SUPABASE_SERVICE_ROLE_KEY` and any future Easebuzz keys exclusively in Edge Function environment secrets.
- [ ] **Rate limiting** — Not implemented anywhere observed; add to public lookup and auth endpoints.
- [ ] **XSS** — Currently clean; keep relying on React's default escaping, avoid introducing `dangerouslySetInnerHTML`.
- [ ] **CORS** — Wildcarded on every Edge Function; tighten before launch (H-02).
- [ ] **Security headers** — None configured; add per H-04.
- [ ] **Dependency vulnerabilities** — 13 open (frontend); triage per §17/§21.
- [ ] **Logging/monitoring** — Edge Functions `console.error` on failures (visible in Supabase function logs) — reasonable baseline; no external alerting/SIEM integration observed (**NOT VERIFIED** — may exist outside this repo).
- [ ] **Backup/recovery** — Not assessed; Supabase-managed Postgres has platform-level backups by default, but retention/PITR configuration was not accessible to this audit (**NOT VERIFIED**).

---

## 23. Final Security Verdict

# NOT READY FOR PRODUCTION

Two CRITICAL, code-level, unauthenticated-or-broadly-authenticated access-control failures (C-01, C-02) allow direct forgery of payment status and tampering with other teams' data without needing to compromise any account. These are exactly the class of finding this audit was instructed never to wave through, and they remain open. Additionally, the "real" payment integration (H-01) does not exist in the codebase in any verifiable form — the live flow depends on a static link and, apparently, manual human reconciliation, which cannot be validated as secure from source review alone.

Until C-01 and C-02 are remediated and a genuine, signature-verified Easebuzz webhook integration replaces the current static-link/manual-reconciliation flow (H-01), this application must not be trusted to handle real payments or real participant data at scale.
