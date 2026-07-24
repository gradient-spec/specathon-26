-- SPECATHON · Admin, extended registration fields, audit log
-- Idempotent. Safe to re-run.

begin;

-- ── 1. Extend teams ──────────────────────────────────────────────
alter table public.teams
  add column if not exists is_internal       boolean not null default true,
  add column if not exists status            text    not null default 'pending',
  add column if not exists notes             text    default '',
  add column if not exists leader_year       text,
  add column if not exists leader_roll       text,
  add column if not exists leader_department text,
  add column if not exists college_state     text;

-- Relax old constraints for the new form (no email at leader level, size 2..4)
alter table public.teams alter column email drop not null;

do $$
begin
  if exists (select 1 from information_schema.check_constraints
             where constraint_name = 'teams_team_size_check') then
    alter table public.teams drop constraint teams_team_size_check;
  end if;
end $$;

alter table public.teams
  add constraint teams_team_size_check check (team_size between 2 and 4);

do $$
begin
  if exists (select 1 from information_schema.check_constraints
             where constraint_name = 'teams_status_check') then
    alter table public.teams drop constraint teams_status_check;
  end if;
end $$;

alter table public.teams
  add constraint teams_status_check
  check (status in ('pending','verified','approved','rejected'));

create index if not exists teams_status_idx      on public.teams (status);
create index if not exists teams_is_internal_idx on public.teams (is_internal);
create index if not exists teams_domain_idx      on public.teams (domain);

-- ── 2. Extend team_members ──────────────────────────────────────
alter table public.team_members
  add column if not exists year        text,
  add column if not exists roll_number text,
  add column if not exists department  text,
  add column if not exists phone       text;

-- ── 3. Admin allow-list ─────────────────────────────────────────
create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- No policies — only service_role can read/write. Admins are managed in Studio.

-- Helper: called from RLS policies to check whether the current
-- authenticated user is on the allow-list.
create or replace function public.is_admin() returns boolean
language sql stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select true
     from public.admins
     where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
     limit 1),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── 4. Audit log ────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor       text,
  action      text        not null,
  target_type text,
  target_id   uuid,
  meta        jsonb       default '{}'::jsonb
);

alter table public.audit_log enable row level security;

drop policy if exists "admin can select audit" on public.audit_log;
drop policy if exists "admin can insert audit" on public.audit_log;

create policy "admin can select audit"
  on public.audit_log for select to authenticated using (public.is_admin());
create policy "admin can insert audit"
  on public.audit_log for insert to authenticated with check (public.is_admin());

-- ── 5. Admin table policies (select/update/delete) ──────────────
-- Anon still cannot read; only admins (authenticated + on allow-list) can.
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('teams','team_members')
      and policyname like 'admin%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "admin select teams" on public.teams
  for select to authenticated using (public.is_admin());
create policy "admin update teams" on public.teams
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin delete teams" on public.teams
  for delete to authenticated using (public.is_admin());

create policy "admin select members" on public.team_members
  for select to authenticated using (public.is_admin());
create policy "admin update members" on public.team_members
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "admin delete members" on public.team_members
  for delete to authenticated using (public.is_admin());

-- Grants: admin actions require both a policy and the table privilege.
grant select, update, delete on public.teams        to authenticated;
grant select, update, delete on public.team_members to authenticated;
grant select, insert         on public.audit_log    to authenticated;

-- ── 6. Registration RPC — extended for new form ─────────────────
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
  m jsonb;
  is_internal_val boolean;
begin
  is_internal_val := coalesce((team->>'is_internal')::boolean, true);

  if coalesce(length(trim(team->>'team_name')),   0) = 0 then raise exception 'team_name is required'    using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')), 0) = 0 then raise exception 'leader_name is required'  using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'phone')),       0) < 7 then raise exception 'phone is invalid'         using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),     0) = 0 then raise exception 'college is required'      using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),      0) = 0 then raise exception 'domain is required'       using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 2 and 4       then raise exception 'team_size must be 2..4'   using errcode = '22023'; end if;

  if is_internal_val then
    if coalesce(length(trim(team->>'leader_year')),       0) = 0 then raise exception 'year required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_roll')),       0) = 0 then raise exception 'roll required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_department')), 0) = 0 then raise exception 'department required' using errcode='22023'; end if;
  else
    if coalesce(length(trim(team->>'college_state')), 0) = 0 then raise exception 'college_state required' using errcode='22023'; end if;
  end if;

  insert into public.teams (
    team_name, leader_name, email, phone, college, team_size, domain,
    github, linkedin, is_internal, leader_year, leader_roll, leader_department,
    college_state, status
  ) values (
    trim(team->>'team_name'),
    trim(team->>'leader_name'),
    nullif(lower(trim(coalesce(team->>'email',''))), ''),
    trim(team->>'phone'),
    trim(team->>'college'),
    (team->>'team_size')::int,
    trim(team->>'domain'),
    nullif(trim(team->>'github'),   ''),
    nullif(trim(team->>'linkedin'), ''),
    is_internal_val,
    nullif(trim(team->>'leader_year'),       ''),
    nullif(trim(team->>'leader_roll'),       ''),
    nullif(trim(team->>'leader_department'), ''),
    nullif(trim(team->>'college_state'),     ''),
    'pending'
  )
  returning id into new_id;

  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb))
  loop
    if coalesce(length(trim(m->>'name')), 0) = 0 then continue; end if;
    insert into public.team_members (
      team_id, name, email, role, year, roll_number, department, phone
    ) values (
      new_id,
      trim(m->>'name'),
      nullif(lower(trim(coalesce(m->>'email',''))), ''),
      nullif(trim(m->>'role'), ''),
      nullif(trim(m->>'year'), ''),
      nullif(trim(m->>'roll_number'), ''),
      nullif(trim(m->>'department'), ''),
      nullif(trim(m->>'phone'), '')
    );
  end loop;

  return new_id;
end;
$$;

revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;

commit;

-- ── 7. Diagnostics ──────────────────────────────────────────────
select 'admins allowlist' as kind, count(*) as rows from public.admins
union all
select 'total teams',           count(*) from public.teams
union all
select 'total members',         count(*) from public.team_members;
