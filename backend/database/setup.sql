-- ═══════════════════════════════════════════════════════════════════════
-- SPECATHON 2026 · Consolidated Supabase setup
-- ═══════════════════════════════════════════════════════════════════════
-- One paste, one Run in the Supabase SQL Editor.
-- Idempotent: safe to re-run at any time.
--
-- What this installs, top to bottom:
--   1. Extensions
--   2. Base tables: teams, team_members
--   3. Extended columns (form fields for St. Peter's + external)
--   4. Constraints, indexes, unique-email guard
--   5. Realtime publication (live dashboard updates)
--   6. Admin allowlist + is_admin() helper
--   7. Audit log
--   8. Row-level security policies
--   9. Storage bucket for abstracts + Storage policies
--  10. register_team(jsonb, jsonb) RPC — the public signup endpoint
--  11. Registrations export view
--  12. Seed the admin allowlist with gradient@stpetershyd.com
--  13. Diagnostics
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Extensions ─────────────────────────────────────────────────────
-- gen_random_uuid() lives in pgcrypto.
create extension if not exists "pgcrypto";


-- ─── 2. Base tables ────────────────────────────────────────────────────
-- teams  = one row per registered team
-- team_members = additional members (leader is stored on `teams` itself)

create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  team_name     text not null,
  leader_name   text not null,
  email         text,                 -- nullable at column level; RPC enforces required
  phone         text not null,
  college       text not null,
  team_size     int  not null,        -- range check installed below
  domain        text not null,
  github        text,
  linkedin      text
);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null,
  email      text,
  role       text,
  created_at timestamptz not null default now()
);


-- ─── 3. Extended columns ───────────────────────────────────────────────
-- All add-column statements are IF NOT EXISTS so re-runs are harmless.

alter table public.teams
  add column if not exists is_internal       boolean not null default true,
  add column if not exists status            text    not null default 'pending',
  add column if not exists notes             text    default '',
  add column if not exists leader_year       text,
  add column if not exists leader_roll       text,
  add column if not exists leader_department text,
  add column if not exists college_state     text,
  add column if not exists college_city      text,
  add column if not exists project_title     text,
  add column if not exists abstract_url      text,
  add column if not exists payment_ack       boolean not null default false,
  add column if not exists reg_code          text;

-- Members get the same extra fields the form collects.
alter table public.team_members
  add column if not exists year        text,
  add column if not exists roll_number text,
  add column if not exists department  text,
  add column if not exists phone       text;


-- ─── 4. Constraints, indexes, unique-email guard ───────────────────────

-- team_size ∈ [2, 4]. Rebuild the constraint so re-runs stay clean.
do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'teams_team_size_check'
  ) then
    alter table public.teams drop constraint teams_team_size_check;
  end if;
end $$;

alter table public.teams
  add constraint teams_team_size_check check (team_size between 2 and 4);

-- status ∈ (pending, verified, approved, rejected)
do $$
begin
  if exists (
    select 1 from information_schema.check_constraints
    where constraint_name = 'teams_status_check'
  ) then
    alter table public.teams drop constraint teams_status_check;
  end if;
end $$;

alter table public.teams
  add constraint teams_status_check
  check (status in ('pending', 'verified', 'approved', 'rejected'));

-- Backfill reg_code for legacy rows, then require it going forward.
-- Format: SPEC26-XXXXXX (first 6 hex chars of the row's UUID, uppercased).
update public.teams
   set reg_code = 'SPEC26-' || upper(substring(replace(id::text, '-', ''), 1, 6))
 where reg_code is null;

alter table public.teams
  alter column reg_code set not null,
  alter column reg_code set default 'SPEC26-' ||
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

-- Indexes used by the dashboard's sort/filter and by joins.
create unique index if not exists teams_reg_code_key      on public.teams (reg_code);
create        index if not exists teams_created_at_idx    on public.teams (created_at desc);
create        index if not exists teams_email_idx         on public.teams (email);
create        index if not exists teams_status_idx        on public.teams (status);
create        index if not exists teams_is_internal_idx   on public.teams (is_internal);
create        index if not exists teams_domain_idx        on public.teams (domain);
create        index if not exists team_members_team_idx   on public.team_members (team_id);

-- One active registration per non-null email. Partial index skips NULLs.
create unique index if not exists teams_email_unique
  on public.teams (lower(email))
  where email is not null;


-- ─── 5. Realtime publication ───────────────────────────────────────────
-- Adds both tables to Supabase's built-in publication so the admin
-- dashboard's Realtime subscription fires INSERT/UPDATE/DELETE events.
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


-- ─── 6. Admin allowlist + is_admin() helper ────────────────────────────

create table if not exists public.admins (
  email      text primary key,   -- store lowercase
  created_at timestamptz not null default now()
);

-- RLS on; no anon/authenticated policies ⇒ only service_role can touch it.
alter table public.admins enable row level security;

-- is_admin() is called from every admin RLS policy. Returns TRUE only if
-- the JWT's email is on the allowlist. SECURITY DEFINER + pinned search_path
-- makes it safe for RLS use without exposing the admins table to callers.
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
grant  execute on function public.is_admin() to anon, authenticated;


-- ─── 7. Audit log ──────────────────────────────────────────────────────
-- Every admin destructive action gets a row here.

create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  actor       text,                       -- admin email who did the thing
  action      text not null,              -- e.g. 'delete', 'status_update'
  target_type text,                       -- e.g. 'team'
  target_id   uuid,
  meta        jsonb default '{}'::jsonb
);

alter table public.audit_log enable row level security;

drop policy if exists "admin can select audit" on public.audit_log;
drop policy if exists "admin can insert audit" on public.audit_log;

create policy "admin can select audit"
  on public.audit_log for select to authenticated using (public.is_admin());
create policy "admin can insert audit"
  on public.audit_log for insert to authenticated with check (public.is_admin());


-- ─── 8. Row-level security policies ────────────────────────────────────

-- Force RLS on the two data tables.
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

-- Wipe every existing policy on these tables so no leftover RESTRICTIVE
-- policy can silently AND-block inserts (this fixed a real bug earlier).
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('teams', 'team_members')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Anon has NO direct table access. Public registration goes through the
-- register_team() RPC (SECURITY DEFINER). This defends against accidental
-- future grants that might otherwise leak emails/phones.
revoke all on public.teams        from anon;
revoke all on public.team_members from anon;

-- Admin policies: authenticated + on the allowlist ⇒ full read/update/delete.
create policy "admin select teams"   on public.teams        for select to authenticated using (public.is_admin());
create policy "admin update teams"   on public.teams        for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete teams"   on public.teams        for delete to authenticated using (public.is_admin());
create policy "admin select members" on public.team_members for select to authenticated using (public.is_admin());
create policy "admin update members" on public.team_members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete members" on public.team_members for delete to authenticated using (public.is_admin());

-- Grants: policies alone aren't enough — the role also needs the privilege.
grant select, update, delete on public.teams        to authenticated;
grant select, update, delete on public.team_members to authenticated;
grant select, insert         on public.audit_log    to authenticated;


-- ─── 9. Storage bucket for abstracts + Storage policies ────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'abstracts',
  'abstracts',
  false,                              -- NOT public; admins fetch via signed URLs
  10 * 1024 * 1024,                   -- 10 MB per file
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Wipe prior storage policies on this bucket so re-runs stay clean.
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (policyname like 'abstracts%' or policyname like 'admin abstracts%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- anon may INSERT into abstracts/submissions/*  (write-only)
create policy "abstracts anon submit"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'abstracts'
    and (storage.foldername(name))[1] = 'submissions'
  );

-- admin (authenticated + on allowlist) may read every abstract
create policy "admin abstracts read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'abstracts' and public.is_admin());

-- admin may delete stale uploads
create policy "admin abstracts delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'abstracts' and public.is_admin());


-- ─── 10. Public signup RPC ─────────────────────────────────────────────
-- The ONE endpoint anon uses to register. Everything else is denied.
-- Returns { id, reg_code } as jsonb. Return type may have changed across
-- previous versions, so drop first.

drop function if exists public.register_team(jsonb, jsonb);

create function public.register_team(
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
begin
  -- Normalize + defaults
  is_internal_val := coalesce((team->>'is_internal')::boolean, true);
  email_norm      := nullif(lower(trim(coalesce(team->>'email', ''))), '');

  -- Required core fields
  if coalesce(length(trim(team->>'team_name')),    0) = 0 then raise exception 'team_name is required'    using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')),  0) = 0 then raise exception 'leader_name is required'  using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'phone')),        0) < 7 then raise exception 'phone is invalid'         using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),      0) = 0 then raise exception 'college is required'      using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),       0) = 0 then raise exception 'domain is required'       using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 2 and 4        then raise exception 'team_size must be 2..4'   using errcode = '22023'; end if;

  -- New required fields (v3)
  if email_norm is null                                            then raise exception 'leader email is required'          using errcode = '22023'; end if;
  if email_norm !~ '^\S+@\S+\.\S+$'                                then raise exception 'leader email is invalid'           using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'project_title')), 0) = 0         then raise exception 'project title is required'         using errcode = '22023'; end if;
  if coalesce((team->>'payment_ack')::boolean, false) is not true  then raise exception 'payment acknowledgement is required' using errcode = '22023'; end if;

  -- Conditional required fields per college type
  if is_internal_val then
    if coalesce(length(trim(team->>'leader_year')),       0) = 0 then raise exception 'year required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_roll')),       0) = 0 then raise exception 'roll required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_department')), 0) = 0 then raise exception 'department required' using errcode='22023'; end if;
  else
    if coalesce(length(trim(team->>'college_state')), 0) = 0 then raise exception 'college state required' using errcode='22023'; end if;
    if coalesce(length(trim(team->>'college_city')),  0) = 0 then raise exception 'college city required'  using errcode='22023'; end if;
  end if;

  -- Preemptive duplicate check ⇒ we can return a specific errcode.
  if exists (select 1 from public.teams where lower(email) = email_norm) then
    raise exception 'This email has already been registered.' using errcode = '23505';
  end if;

  -- Insert the team row.
  insert into public.teams (
    team_name, leader_name, email, phone, college, team_size, domain,
    github, linkedin, is_internal, leader_year, leader_roll, leader_department,
    college_state, college_city, project_title, abstract_url, payment_ack, status
  ) values (
    trim(team->>'team_name'),
    trim(team->>'leader_name'),
    email_norm,
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
    nullif(trim(team->>'college_city'),      ''),
    trim(team->>'project_title'),
    nullif(trim(team->>'abstract_url'),      ''),
    true,
    'pending'
  )
  returning id, reg_code into new_id, new_code;

  -- Insert each member, skipping empty entries.
  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb))
  loop
    if coalesce(length(trim(m->>'name')), 0) = 0 then continue; end if;
    member_email := nullif(lower(trim(coalesce(m->>'email', ''))), '');
    insert into public.team_members (
      team_id, name, email, role, year, roll_number, department, phone
    ) values (
      new_id,
      trim(m->>'name'),
      member_email,
      nullif(trim(m->>'role'), ''),
      nullif(trim(m->>'year'), ''),
      nullif(trim(m->>'roll_number'), ''),
      nullif(trim(m->>'department'), ''),
      nullif(trim(m->>'phone'), '')
    );
  end loop;

  return jsonb_build_object('id', new_id, 'reg_code', new_code);

exception
  -- Race-condition safety net: if two people submit the same email
  -- at the exact same moment, one hits the unique index and we
  -- return the same friendly message.
  when unique_violation then
    raise exception 'This email has already been registered.' using errcode = '23505';
end;
$$;

revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;


-- ─── 11. Registrations export view ─────────────────────────────────────
-- Flat, one-row-per-team roll-up. Useful for a quick CSV from the
-- Table Editor. The app has its own richer exports.

create or replace view public.registrations_export as
select
  t.reg_code                                                  as registration_id,
  t.created_at                                                as registered_at,
  t.team_name,
  t.team_size,
  t.domain,
  t.college,
  t.college_city,
  t.college_state,
  t.project_title,
  t.abstract_url,
  t.leader_name,
  t.email                                                     as leader_email,
  t.phone                                                     as leader_phone,
  t.leader_year,
  t.leader_roll,
  t.leader_department,
  t.status,
  coalesce(
    string_agg(
      m.name ||
      case when m.email is not null then ' <' || m.email || '>' else '' end,
      ' | '
      order by m.created_at
    ),
    ''
  )                                                           as members
from public.teams t
left join public.team_members m on m.team_id = t.id
group by t.id
order by t.created_at desc;


-- ─── 12. Seed the admin allowlist ──────────────────────────────────────
-- After this, sign into /admin/login with the same email
-- (create the auth user for it under Authentication → Users).

insert into public.admins (email)
values (lower('gradient@stpetershyd.com'))
on conflict (email) do nothing;


commit;


-- ─── 13. Diagnostics ────────────────────────────────────────────────────
-- Expect: teams=0, members=0, admins=1, bucket=1, rpc exists (execute=true),
-- and a list of the admin policies just installed.

select 'teams'         as kind, count(*)::text as value from public.teams
union all
select 'team_members',       count(*)::text from public.team_members
union all
select 'admins',             count(*)::text from public.admins
union all
select 'abstracts bucket',   count(*)::text from storage.buckets where id = 'abstracts'
union all
select 'anon can register_team',
       has_function_privilege('anon', 'public.register_team(jsonb, jsonb)', 'EXECUTE')::text
union all
select 'admin@allowlist',
       (select email from public.admins where email = lower('gradient@stpetershyd.com'));

select tablename, policyname, cmd, roles, permissive
  from pg_policies
 where schemaname = 'public'
   and tablename in ('teams', 'team_members', 'admins', 'audit_log')
 order by tablename, cmd, policyname;
