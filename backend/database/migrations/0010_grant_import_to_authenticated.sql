-- SPECATHON 2026 · V2 — Grant import_shortlisted_teams to authenticated
--
-- Migration 0009 only granted EXECUTE to service_role.
-- The admin dashboard uses the standard Supabase client with an anon/JWT
-- key (not the service role), so authenticated admins could not call
-- the RPC — Supabase returned a 404-style permission-denied error, which
-- the frontend displayed as "[object Object]".
--
-- Fix: also grant EXECUTE to the authenticated role so that any
-- logged-in user whose JWT passes the is_admin() check can call it.
-- The function itself is SECURITY DEFINER, so it runs as the function
-- owner regardless — this grant only controls who may invoke it.
--
-- Idempotent. Safe to re-run.

grant execute on function public.import_shortlisted_teams(jsonb) to authenticated;
