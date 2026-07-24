-- SPECATHON 2026 · Sequential Team ID
-- Adds a Postgres sequence and a helper RPC so the Edge Function can
-- obtain a concurrency-safe SPEC2026-NNNN identifier atomically.
--
-- Why a sequence and not COUNT(*) or MAX()+1:
--   Two simultaneous INSERT operations reading COUNT(*) would both see
--   the same count and produce the same ID.  nextval() on a sequence is
--   an atomic operation that Postgres serialises internally; every caller
--   receives a unique value regardless of concurrent load.
--
-- Idempotent. Safe to re-run.

begin;

-- ── 1. Sequence ────────────────────────────────────────────────────────
-- Starts at 1, increments by 1, never cycles.
-- If re-running and sequence already exists, the CREATE is skipped.
create sequence if not exists public.team_id_seq
  start with 1
  increment by 1
  no cycle;

-- ── 2. RPC exposed to the Edge Function ───────────────────────────────
-- Returns the next sequence value as an integer.
-- The Edge Function formats it into SPEC2026-NNNN.
--
-- SECURITY DEFINER so anon / service_role callers can advance the
-- sequence without needing direct access to the sequence object.
-- search_path is pinned to block injection attacks on SECURITY DEFINER.

create or replace function public.next_team_seq()
  returns bigint
  language sql
  security definer
  set search_path = public, pg_temp
as $$
  select nextval('public.team_id_seq');
$$;

-- Revoke public default and grant only to roles that need it.
revoke all on function public.next_team_seq() from public;
grant  execute on function public.next_team_seq() to anon, authenticated, service_role;

commit;

-- ── 3. Diagnostics ────────────────────────────────────────────────────
-- Expect: next call returns 1 (or current + 1 if already used).
-- select public.next_team_seq() as first_id;
-- Reset for a clean slate (only run manually if needed):
-- alter sequence public.team_id_seq restart with 1;
