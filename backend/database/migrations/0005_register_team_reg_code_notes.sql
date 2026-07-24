-- SPECATHON 2026 · register_team() — add reg_code and notes to INSERT
-- Idempotent. Safe to re-run.
--
-- What changes:
--   The INSERT inside register_team() previously did not include reg_code
--   or notes in its column list, so the Edge Function's team->>'reg_code'
--   and team->>'notes' values were silently discarded.
--
-- What is preserved (unchanged):
--   • Function signature            (team jsonb, members jsonb)
--   • Return type                   (jsonb)
--   • All DECLARE variables
--   • All validation IF blocks
--   • The duplicate-email check
--   • The RETURNING clause          (id, reg_code)
--   • The team_members INSERT loop
--   • The EXCEPTION block
--   • SECURITY DEFINER + search_path
--   • All GRANT / REVOKE statements
--
-- The function signature and return type are identical to the previous
-- version, so CREATE OR REPLACE is legal here (no DROP required).

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
begin
  is_internal_val := coalesce((team->>'is_internal')::boolean, true);
  email_norm      := nullif(lower(trim(coalesce(team->>'email', ''))), '');

  -- ── Required core fields ──────────────────────────────────────────────────
  if coalesce(length(trim(team->>'team_name')),    0) = 0 then raise exception 'team_name is required'    using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'leader_name')),  0) = 0 then raise exception 'leader_name is required'  using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'phone')),        0) < 7 then raise exception 'phone is invalid'         using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'college')),      0) = 0 then raise exception 'college is required'      using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'domain')),       0) = 0 then raise exception 'domain is required'       using errcode = '22023'; end if;
  if (team->>'team_size')::int not between 2 and 4        then raise exception 'team_size must be 2..4'   using errcode = '22023'; end if;

  if email_norm is null                                                   then raise exception 'leader email is required'           using errcode = '22023'; end if;
  if email_norm !~ '^\S+@\S+\.\S+$'                                       then raise exception 'leader email is invalid'            using errcode = '22023'; end if;
  if coalesce(length(trim(team->>'project_title')), 0) = 0                then raise exception 'project title is required'          using errcode = '22023'; end if;
  if coalesce((team->>'payment_ack')::boolean, false) is not true         then raise exception 'payment acknowledgement is required' using errcode = '22023'; end if;

  if is_internal_val then
    if coalesce(length(trim(team->>'leader_year')),       0) = 0 then raise exception 'year required'       using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'leader_roll')),       0) = 0 then raise exception 'roll required'       using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'leader_department')), 0) = 0 then raise exception 'department required' using errcode = '22023'; end if;
  else
    if coalesce(length(trim(team->>'college_state')), 0) = 0 then raise exception 'college state required' using errcode = '22023'; end if;
    if coalesce(length(trim(team->>'college_city')),  0) = 0 then raise exception 'college city required'  using errcode = '22023'; end if;
  end if;

  -- ── Duplicate-email guard ─────────────────────────────────────────────────
  if exists (select 1 from public.teams where lower(email) = email_norm) then
    raise exception 'This email has already been registered.' using errcode = '23505';
  end if;

  -- ── Team INSERT ───────────────────────────────────────────────────────────
  -- CHANGED: added reg_code and notes to both the column list and values list.
  -- Everything else is identical to the previous version.
  insert into public.teams (
    team_name, leader_name, email, phone, college, team_size, domain,
    github, linkedin, is_internal, leader_year, leader_roll, leader_department,
    college_state, college_city, project_title, abstract_url, payment_ack, status,
    reg_code,                  -- ← added
    notes                      -- ← added
  ) values (
    trim(team->>'team_name'),
    trim(team->>'leader_name'),
    email_norm,
    trim(team->>'phone'),
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
    nullif(trim(team->>'reg_code'),  ''),  -- ← added: SPEC2026-NNNN from Edge Function
    nullif(trim(team->>'notes'),     '')   -- ← added: JSON string from Edge Function
  )
  returning id, reg_code into new_id, new_code;

  -- ── Members INSERT loop ───────────────────────────────────────────────────
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
    raise exception 'This email has already been registered.' using errcode = '23505';
end;
$$;

-- Grants are unchanged but re-applied to be safe after CREATE OR REPLACE.
revoke all on function public.register_team(jsonb, jsonb) from public;
grant  execute on function public.register_team(jsonb, jsonb) to anon, authenticated;
