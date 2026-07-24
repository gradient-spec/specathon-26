-- SPECATHON · Public registration via SECURITY DEFINER RPC
-- Idempotent. Safe to re-run.
--
-- Architecture:
--   • anon has NO direct access to teams / team_members tables.
--   • anon has EXECUTE on public.register_team(jsonb, jsonb).
--   • The function runs as its owner (definer) and inserts both
--     the team row and its members atomically. It returns the new
--     team id. Because anon never touches the tables directly,
--     no email/phone/team can ever leak via a table scan.
--   • Reads happen server-side with service_role (Studio, exports).
--
-- Security rationale:
--   1. RLS remains ENABLED (defense in depth); tables reject any
--      accidental direct access from anon even if a future grant slips.
--   2. The RPC validates every field and enforces business rules
--      (team size 1–5, email shape, member count) inside the DB.
--   3. `search_path = public, pg_temp` on the function blocks
--      search-path injection attacks on SECURITY DEFINER functions.
--   4. The function is owned by postgres, executed by anon — anon
--      cannot bypass validation or read other rows.

begin;

-- ── 1. Ensure RLS is on and no stale policies remain ─────────────
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public' and tablename in ('teams', 'team_members')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- No permissive policies for anon on the tables themselves.
-- (RLS with no policy = deny all for non-owner roles.)

-- Revoke any lingering direct table grants to anon just in case.
revoke all on public.teams        from anon;
revoke all on public.team_members from anon;

-- ── 2. The registration RPC ──────────────────────────────────────
create or replace function public.register_team(
  team    jsonb,
  members jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  m      jsonb;
  member_count int;
begin
  -- Validate required fields
  if coalesce(length(trim(team->>'team_name')),   0) = 0 then raise exception 'team_name is required'   using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')), 0) = 0 then raise exception 'leader_name is required' using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'email')),       0) = 0 then raise exception 'email is required'       using errcode = '22023'; end if;
  if (team->>'email') !~ '^\S+@\S+\.\S+$'                then raise exception 'email is invalid'        using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'phone')),       0) < 4 then raise exception 'phone is invalid'        using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),     0) = 0 then raise exception 'college is required'     using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),      0) = 0 then raise exception 'domain is required'     using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 1 and 5       then raise exception 'team_size must be 1..5'  using errcode = '22023'; end if;

  member_count := jsonb_array_length(coalesce(members, '[]'::jsonb));
  if member_count > 5 then
    raise exception 'too many members' using errcode = '22023';
  end if;

  insert into public.teams (
    team_name, leader_name, email, phone, college,
    team_size, domain, github, linkedin
  ) values (
    trim(team->>'team_name'),
    trim(team->>'leader_name'),
    lower(trim(team->>'email')),
    trim(team->>'phone'),
    trim(team->>'college'),
    (team->>'team_size')::int,
    trim(team->>'domain'),
    nullif(trim(team->>'github'),   ''),
    nullif(trim(team->>'linkedin'), '')
  )
  returning id into new_id;

  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb))
  loop
    if coalesce(length(trim(m->>'name')), 0) = 0 then continue; end if;
    insert into public.team_members (team_id, name, email, role)
    values (
      new_id,
      trim(m->>'name'),
      nullif(lower(trim(m->>'email')), ''),
      nullif(trim(m->>'role'), '')
    );
  end loop;

  return new_id;
end;
$$;

-- ── 3. Lock down and re-grant execute ────────────────────────────
revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;

-- ── 4. Enable Realtime on both tables (for scripts/sync-csv.mjs) ──
do $$
begin
  begin
    alter publication supabase_realtime add table public.teams;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.team_members;
  exception when duplicate_object then null;
  end;
end $$;

commit;

-- ── 5. Diagnostics ───────────────────────────────────────────────
-- Expect zero policy rows (we deny direct table access to anon)
select tablename, policyname
from pg_policies
where schemaname = 'public' and tablename in ('teams', 'team_members');

-- Expect true / true
select
  has_function_privilege('anon',          'public.register_team(jsonb, jsonb)', 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', 'public.register_team(jsonb, jsonb)', 'EXECUTE') as authed_execute;
