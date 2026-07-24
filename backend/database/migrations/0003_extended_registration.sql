-- SPECATHON · Registration v2 — email uniqueness, project details,
-- abstract upload, payment acknowledgement, college city.
-- Idempotent. Safe to re-run.

begin;

-- ── 1. New columns on teams ──────────────────────────────────────
alter table public.teams
  add column if not exists college_city   text,
  add column if not exists project_title  text,
  add column if not exists abstract_url   text,
  add column if not exists payment_ack    boolean not null default false,
  add column if not exists reg_code       text;

-- Short, human-friendly registration code (SPEC26-XXXXXX from the UUID).
update public.teams
   set reg_code = 'SPEC26-' || upper(substring(replace(id::text, '-', ''), 1, 6))
 where reg_code is null;

alter table public.teams
  alter column reg_code set not null,
  alter column reg_code set default 'SPEC26-' ||
    upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));

create unique index if not exists teams_reg_code_key on public.teams (reg_code);

-- ── 2. Unique email for team lead ────────────────────────────────
-- Only one active registration per email. NULL emails are allowed
-- (partial unique index skips them), so legacy rows without email survive.
create unique index if not exists teams_email_unique
  on public.teams (lower(email))
  where email is not null;

-- ── 3. Members: ensure email column exists (parity for member 1) ─
alter table public.team_members
  add column if not exists email text;

-- ── 4. Storage bucket for abstracts ──────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'abstracts',
  'abstracts',
  false,
  10 * 1024 * 1024,  -- 10 MB per file
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Wipe any prior policies on abstracts and re-create cleanly.
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename  = 'objects'
      and (policyname like 'abstracts%' or policyname like 'admin abstracts%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- anon may INSERT into abstracts/submissions/*  (write-only, cannot list/read)
create policy "abstracts anon submit"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'abstracts'
    and (storage.foldername(name))[1] = 'submissions'
  );

-- admins (authenticated + on allowlist) may read every object in the bucket
create policy "admin abstracts read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'abstracts' and public.is_admin());

-- admins may delete stale uploads
create policy "admin abstracts delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'abstracts' and public.is_admin());

-- ── 5. Updated registration RPC ──────────────────────────────────
-- Return type changed from uuid → jsonb, so drop the old signature
-- (Postgres forbids CREATE OR REPLACE across return-type changes).
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
  is_internal_val := coalesce((team->>'is_internal')::boolean, true);
  email_norm      := nullif(lower(trim(coalesce(team->>'email', ''))), '');

  -- ── Required core fields ──
  if coalesce(length(trim(team->>'team_name')),    0) = 0 then raise exception 'team_name is required'    using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')),  0) = 0 then raise exception 'leader_name is required'  using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'phone')),        0) < 7 then raise exception 'phone is invalid'         using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),      0) = 0 then raise exception 'college is required'      using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),       0) = 0 then raise exception 'domain is required'       using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 2 and 4        then raise exception 'team_size must be 2..4'   using errcode = '22023'; end if;

  -- New required fields
  if email_norm is null                                                    then raise exception 'leader email is required' using errcode = '22023'; end if;
  if email_norm !~ '^\S+@\S+\.\S+$'                                        then raise exception 'leader email is invalid'  using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'project_title')), 0) = 0                 then raise exception 'project title is required' using errcode = '22023'; end if;
  if coalesce((team->>'payment_ack')::boolean, false) is not true          then raise exception 'payment acknowledgement is required' using errcode = '22023'; end if;

  if is_internal_val then
    if coalesce(length(trim(team->>'leader_year')),       0) = 0 then raise exception 'year required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_roll')),       0) = 0 then raise exception 'roll required'       using errcode='22023'; end if;
    if coalesce(length(trim(team->>'leader_department')), 0) = 0 then raise exception 'department required' using errcode='22023'; end if;
  else
    if coalesce(length(trim(team->>'college_state')), 0) = 0 then raise exception 'college state required' using errcode='22023'; end if;
    if coalesce(length(trim(team->>'college_city')),  0) = 0 then raise exception 'college city required'  using errcode='22023'; end if;
  end if;

  -- Preemptive duplicate check so we return a specific error code the client can map.
  if exists (select 1 from public.teams where lower(email) = email_norm) then
    raise exception 'This email has already been registered.' using errcode = '23505';
  end if;

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
  when unique_violation then
    raise exception 'This email has already been registered.' using errcode = '23505';
end;
$$;

revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;

commit;

-- ── 6. Diagnostics ──────────────────────────────────────────────
select 'teams'         as kind, count(*) as rows from public.teams
union all
select 'unique emails',        count(distinct lower(email)) from public.teams where email is not null
union all
select 'abstracts bucket',     count(*) from storage.buckets where id = 'abstracts';
