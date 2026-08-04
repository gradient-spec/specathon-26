-- SPECATHON 2026 · V2 — Add email column to shortlisted_teams
--
-- shortlisted_teams.contact stores the team lead's phone number.
-- To send confirmation emails we need the team lead's email address.
--
-- For WEBSITE registrations: email is available in public.teams.email.
-- For UNSTOP registrations:  email must be provided in the import CSV.
--
-- Strategy:
--   • Add nullable email column to shortlisted_teams.
--   • Update import_shortlisted_teams() to accept and store email.
--   • Back-fill existing WEBSITE rows by joining public.teams on reg_code.
--   • UNSTOP rows with no email remain NULL — email is not sent for those.
--
-- Idempotent. Safe to re-run.

begin;

-- ── 1. Add email column ───────────────────────────────────────────────────────
alter table public.shortlisted_teams
  add column if not exists email text;

-- ── 2. Back-fill from public.teams for WEBSITE registrations ─────────────────
-- team_id in shortlisted_teams equals reg_code in teams for WEBSITE source.
update public.shortlisted_teams st
set    email = t.email
from   public.teams t
where  st.registration_source = 'WEBSITE'
  and  st.team_id             = t.reg_code
  and  st.email               is null;

-- ── 3. Replace import_shortlisted_teams() to accept optional email field ──────
create or replace function public.import_shortlisted_teams(
  rows jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_count       int := 0;
  upsert_count    int := 0;
  r               jsonb;
  row_num         int := 0;
  team_size_val   int;
  amount_val      int;
  expected_amount int;
  email_val       text;
begin
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'import_shortlisted_teams: input must be a JSON array'
      using errcode = '22023';
  end if;

  row_count := jsonb_array_length(rows);

  if row_count = 0 then
    raise exception 'import_shortlisted_teams: no rows to import'
      using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(rows)
  loop
    row_num := row_num + 1;

    if coalesce(length(trim(r->>'team_id')), 0) = 0 then
      raise exception 'Row %: team_id is required', row_num using errcode = '22023';
    end if;

    if (r->>'registration_source') not in ('WEBSITE', 'UNSTOP') then
      raise exception 'Row %: registration_source must be WEBSITE or UNSTOP (got "%")',
        row_num, r->>'registration_source' using errcode = '22023';
    end if;

    if coalesce(length(trim(r->>'team_name')), 0) = 0 then
      raise exception 'Row %: team_name is required', row_num using errcode = '22023';
    end if;

    if coalesce(length(trim(r->>'team_lead_name')), 0) = 0 then
      raise exception 'Row %: team_lead_name is required', row_num using errcode = '22023';
    end if;

    if coalesce(length(trim(r->>'contact')), 0) = 0 then
      raise exception 'Row %: contact is required', row_num using errcode = '22023';
    end if;

    begin
      team_size_val := (r->>'team_size')::int;
    exception when others then
      raise exception 'Row %: team_size must be an integer (got "%")',
        row_num, r->>'team_size' using errcode = '22023';
    end;

    if team_size_val not between 2 and 4 then
      raise exception 'Row %: team_size must be between 2 and 4 (got %)',
        row_num, team_size_val using errcode = '22023';
    end if;

    begin
      amount_val := (r->>'amount')::int;
    exception when others then
      raise exception 'Row %: amount must be an integer (got "%")',
        row_num, r->>'amount' using errcode = '22023';
    end;

    expected_amount := case team_size_val
      when 2 then 800
      when 3 then 1200
      when 4 then 1600
    end;

    if amount_val <> expected_amount then
      raise exception 'Row %: amount for team_size % must be % (got %)',
        row_num, team_size_val, expected_amount, amount_val using errcode = '22023';
    end if;

    if (r->>'payment_status') <> 'PENDING' then
      raise exception 'Row %: payment_status must be PENDING on import (got "%")',
        row_num, r->>'payment_status' using errcode = '22023';
    end if;

    -- Resolve email:
    --   • If CSV provides email field → use it.
    --   • For WEBSITE registrations with no CSV email → look up from teams table.
    --   • UNSTOP with no email → NULL (email will not be sent).
    email_val := nullif(trim(coalesce(r->>'email', '')), '');

    if email_val is null and (r->>'registration_source') = 'WEBSITE' then
      select t.email into email_val
      from   public.teams t
      where  t.reg_code = trim(r->>'team_id')
      limit  1;
    end if;

    insert into public.shortlisted_teams (
      team_id,
      registration_source,
      team_name,
      team_lead_name,
      contact,
      email,
      team_size,
      amount,
      payment_status,
      payment_notes
    ) values (
      trim(r->>'team_id'),
      r->>'registration_source',
      trim(r->>'team_name'),
      trim(r->>'team_lead_name'),
      trim(r->>'contact'),
      email_val,
      team_size_val,
      amount_val,
      'PENDING',
      nullif(trim(coalesce(r->>'payment_notes', '')), '')
    )
    on conflict (team_id) do update set
      registration_source = excluded.registration_source,
      team_name           = excluded.team_name,
      team_lead_name      = excluded.team_lead_name,
      contact             = excluded.contact,
      email               = coalesce(excluded.email, shortlisted_teams.email),
      team_size           = excluded.team_size,
      amount              = excluded.amount;
      -- payment_status, payment_notes, paid_at intentionally NOT updated

    upsert_count := upsert_count + 1;
  end loop;

  return jsonb_build_object(
    'imported', upsert_count,
    'status',   'ok'
  );
end;
$$;

revoke all on function public.import_shortlisted_teams(jsonb) from public;
grant  execute on function public.import_shortlisted_teams(jsonb) to service_role;
grant  execute on function public.import_shortlisted_teams(jsonb) to authenticated;

commit;
