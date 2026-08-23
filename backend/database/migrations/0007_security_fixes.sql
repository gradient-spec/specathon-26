-- SPECATHON 2026 · Security hardening — migration 0007
--
-- Addresses three findings from the August 2026 security audit:
--
-- FIX 1: register_team() — remove `notes` from INSERT
--   The `notes` column is admin-only and should only be written by
--   authenticated admins via the updateTeamNotes() service. Migration 0005
--   accidentally included it in the public RPC INSERT, allowing any
--   unauthenticated caller to inject arbitrary text into admin notes.
--   This migration removes `notes` from the column and values lists while
--   preserving every other field and behaviour from migration 0006
--   (the currently deployed version).
--
-- FIX 2: next_team_seq() — revoke EXECUTE from anon
--   Migration 0004 granted EXECUTE to anon so the Edge Function could call
--   it. The Edge Function runs under service_role credentials, so the anon
--   grant was never required. Any unauthenticated caller could advance the
--   sequence indefinitely, enumerating registration counts and creating gaps
--   in SPEC2026-NNNN codes. Revoke from anon; keep service_role.
--
-- FIX 3: registrations_export view — explicit revoke from anon/public
--   The view joins teams + team_members including email and phone. Although
--   the underlying table RLS blocks direct anon reads, PostgREST may expose
--   views differently depending on security_invoker settings. Explicit revoke
--   eliminates the ambiguity.
--
-- None of these fixes alter:
--   • The teams or team_members table schema
--   • Any existing registration data
--   • Any legitimate frontend registration flow
--   • Admin update of notes via updateTeamNotes()
--   • The reg_code generation and storage path
--
-- Idempotent. Safe to re-run.

begin;

-- ══════════════════════════════════════════════════════════════════════════
-- FIX 1: register_team() — remove notes from public INSERT
-- ══════════════════════════════════════════════════════════════════════════
--
-- This is an exact reproduction of the 0006 function body with ONE change:
--   • "notes" removed from the INSERT column list
--   • the corresponding nullif(trim(team->>'notes'),'') removed from VALUES
-- Everything else (phone guards, email guards, all other fields, RETURNING,
-- members loop, EXCEPTION block, SECURITY DEFINER, search_path) is unchanged.

create or replace function public.register_team(
  team    jsonb,
  members jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id           uuid;
  new_code         text;
  m                jsonb;
  is_internal_val  boolean;
  email_norm       text;
  member_email     text;
  phone_norm       text;
begin
  is_internal_val := coalesce((team->>'is_internal')::boolean, true);
  email_norm      := nullif(lower(trim(coalesce(team->>'email', ''))), '');
  phone_norm      := trim(team->>'phone');

  -- required core fields (unchanged from 0006)
  if coalesce(length(trim(team->>'team_name')),    0) = 0 then raise exception 'team_name is required'    using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')),  0) = 0 then raise exception 'leader_name is required'  using errcode = '22023'; end if;
  if coalesce(length(phone_norm),                  0) < 7 then raise exception 'phone is invalid'         using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),      0) = 0 then raise exception 'college is required'      using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),       0) = 0 then raise exception 'domain is required'       using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 2 and 4        then raise exception 'team_size must be 2..4'   using errcode = '22023'; end if;

  if email_norm is null                                                    then raise exception 'leader email is required'           using errcode = '22023'; end if;
  if email_norm !~ '^\S+@\S+\.\S+$'                                        then raise exception 'leader email is invalid'            using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'project_title')), 0) = 0                 then raise exception 'project title is required'          using errcode = '22023'; end if;
  if coalesce((team->>'payment_ack')::boolean, false) is not true          then raise exception 'payment acknowledgement is required' using errcode = '22023'; end if;

  if is_internal_val then
    if coalesce(length(trim(team->>'leader_year')),       0) = 0 then raise exception 'year required'       using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'leader_roll')),       0) = 0 then raise exception 'roll required'       using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'leader_department')), 0) = 0 then raise exception 'department required' using errcode = '22023'; end if;
  else
    if coalesce(length(trim(team->>'college_state')), 0) = 0 then raise exception 'college state required' using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'college_city')),  0) = 0 then raise exception 'college city required'  using errcode = '22023'; end if;
  end if;

  -- duplicate email guard (unchanged from 0006)
  if exists (select 1 from public.teams where lower(email) = email_norm) then
    raise exception 'This email has already been registered.' using errcode = '23505';
  end if;

  -- duplicate phone guard — leader vs leader phones (unchanged from 0006)
  if exists (select 1 from public.teams where phone = phone_norm) then
    raise exception 'This phone number has already been registered.' using errcode = '23505';
  end if;

  -- duplicate phone guard — leader vs member phones (unchanged from 0006)
  if exists (select 1 from public.team_members where phone = phone_norm) then
    raise exception 'This phone number has already been registered.' using errcode = '23505';
  end if;

  -- ── INSERT: notes column intentionally omitted (FIX 1) ────────────────
  -- notes is an admin-only field. It is set post-registration by admins via
  -- the authenticated updateTeamNotes() service (UPDATE on the teams table
  -- gated by is_admin()). It must never be written by the public RPC.
  insert into public.teams (
    team_name, leader_name, email, phone, college, team_size, domain,
    github, linkedin, is_internal, leader_year, leader_roll, leader_department,
    college_state, college_city, project_title, abstract_url, payment_ack, status,
    reg_code
    -- notes: intentionally excluded — admin-only field
  ) values (
    trim(team->>'team_name'),
    trim(team->>'leader_name'),
    email_norm,
    phone_norm,
    trim(team->>'college'),
    (team->>'team_size')::int,
    trim(team->>'domain'),
    nullif(trim(team->>'github'),            ''),
    nullif(trim(team->>'linkedin'),          ''),
    is_internal_val,
    nullif(trim(team->>'leader_year'),       ''),
    nullif(trim(team->>'leader_roll'),       ''),
    nullif(trim(team->>'leader_department'), ''),
    nullif(trim(team->>'college_state'),     ''),
    nullif(trim(team->>'college_city'),      ''),
    trim(team->>'project_title'),
    nullif(trim(team->>'abstract_url'),      ''),
    true,
    'pending',
    nullif(trim(team->>'reg_code'), '')
    -- nullif(trim(team->>'notes'), '') removed: FIX 1
  )
  returning id, reg_code into new_id, new_code;

  -- members loop (unchanged from 0006)
  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb))
  loop
    if coalesce(length(trim(m->>'name')), 0) = 0 then continue; end if;
    member_email := nullif(lower(trim(coalesce(m->>'email', ''))), '');

    -- duplicate phone guard per member (unchanged from 0006)
    if nullif(trim(m->>'phone'), '') is not null then
      if exists (select 1 from public.teams where phone = trim(m->>'phone')) then
        raise exception 'A phone number in your team has already been registered.' using errcode = '23505';
      end if;
      if exists (select 1 from public.team_members where phone = trim(m->>'phone')) then
        raise exception 'A phone number in your team has already been registered.' using errcode = '23505';
      end if;
    end if;

    insert into public.team_members (
      team_id, name, email, role, year, roll_number, department, phone
    ) values (
      new_id,
      trim(m->>'name'),
      member_email,
      nullif(trim(m->>'role'),        ''),
      nullif(trim(m->>'year'),        ''),
      nullif(trim(m->>'roll_number'), ''),
      nullif(trim(m->>'department'),  ''),
      nullif(trim(m->>'phone'),       '')
    );
  end loop;

  return jsonb_build_object('id', new_id, 'reg_code', new_code);

exception
  when unique_violation then
    raise exception 'This phone number or email has already been registered.' using errcode = '23505';
end;
$$;

-- Grants unchanged from 0006
revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- FIX 2: next_team_seq() — revoke EXECUTE from anon
-- ══════════════════════════════════════════════════════════════════════════
--
-- Migration 0004 granted anon so the Edge Function could call it.
-- The Edge Function runs under service_role credentials (SUPABASE_SERVICE_ROLE_KEY),
-- not anon. The anon grant was therefore unnecessary and allowed any
-- unauthenticated caller to advance the sequence.
--
-- authenticated is also not required by any V1 flow — keeping it is
-- harmless but unnecessary. It is retained here to avoid breaking any
-- admin tooling that might call it directly, but could be revoked too.

revoke execute on function public.next_team_seq() from anon, authenticated;
-- service_role retains EXECUTE for the Edge Function
-- anon: revoked — not required by any V1 flow
-- authenticated: revoked — not required by any V1 flow


-- ══════════════════════════════════════════════════════════════════════════
-- FIX 3: registrations_export — explicit revoke from anon and public
-- ══════════════════════════════════════════════════════════════════════════
--
-- The view joins teams + team_members and exposes email and phone.
-- Although the underlying table RLS blocks anon, PostgREST view handling
-- can vary. Explicit revoke eliminates ambiguity.

revoke all on public.registrations_export from anon;
revoke all on public.registrations_export from public;


commit;


-- ══════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION QUERIES
-- Run these in the Supabase SQL Editor after applying this migration
-- to confirm the fixes are correctly deployed.
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Confirm notes is NOT in the register_team() function source:
--    select prosrc from pg_proc
--    where proname = 'register_team'
--      and pronamespace = 'public'::regnamespace;
--    Expected: prosrc contains reg_code in INSERT but NOT 'notes'
--              (beyond the comment "intentionally excluded")

-- 2. Confirm anon cannot execute next_team_seq():
--    select has_function_privilege('anon', 'public.next_team_seq()', 'EXECUTE');
--    Expected: false

-- 2b. Confirm authenticated cannot execute next_team_seq():
--    select has_function_privilege('authenticated', 'public.next_team_seq()', 'EXECUTE');
--    Expected: false

-- 3. Confirm service_role can execute next_team_seq():
--    select has_function_privilege('service_role', 'public.next_team_seq()', 'EXECUTE');
--    Expected: true

-- 4. Confirm registrations_export has no anon/public privileges:
--    select grantee, privilege_type
--    from information_schema.role_table_grants
--    where table_name = 'registrations_export'
--      and grantee in ('anon', 'public', 'PUBLIC');
--    Expected: 0 rows
