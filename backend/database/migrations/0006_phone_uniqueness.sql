-- SPECATHON 2026 · Phone uniqueness enforcement
-- Adds unique indexes on phone across teams + team_members,
-- and updates register_team() to reject duplicate phone numbers
-- from both leaders and members before inserting.
-- Idempotent. Safe to re-run.

begin;

-- ── 1. Unique indexes ─────────────────────────────────────────────
-- One registration per phone number at the leader level.
create unique index if not exists teams_phone_unique
  on public.teams (phone);

-- One registration per phone number at the member level (skip nulls).
create unique index if not exists team_members_phone_unique
  on public.team_members (phone)
  where phone is not null and trim(phone) != '';

-- ── 2. Updated register_team() with phone duplicate guards ────────
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

  -- required core fields
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

  -- duplicate email guard
  if exists (select 1 from public.teams where lower(email) = email_norm) then
    raise exception 'This email has already been registered.' using errcode = '23505';
  end if;

  -- duplicate phone guard (leader phone vs all leader phones)
  if exists (select 1 from public.teams where phone = phone_norm) then
    raise exception 'This phone number has already been registered.' using errcode = '23505';
  end if;

  -- duplicate phone guard (leader phone vs all member phones)
  if exists (select 1 from public.team_members where phone = phone_norm) then
    raise exception 'This phone number has already been registered.' using errcode = '23505';
  end if;

  insert into public.teams (
    team_name, leader_name, email, phone, college, team_size, domain,
    github, linkedin, is_internal, leader_year, leader_roll, leader_department,
    college_state, college_city, project_title, abstract_url, payment_ack, status,
    reg_code, notes
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
    nullif(trim(team->>'reg_code'), ''),
    nullif(trim(team->>'notes'),    '')
  )
  returning id, reg_code into new_id, new_code;

  for m in select * from jsonb_array_elements(coalesce(members, '[]'::jsonb))
  loop
    if coalesce(length(trim(m->>'name')), 0) = 0 then continue; end if;
    member_email := nullif(lower(trim(coalesce(m->>'email', ''))), '');

    -- duplicate phone guard (each member phone vs leader + all prior members)
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

revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;

commit;
