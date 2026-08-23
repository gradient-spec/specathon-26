-- SPECATHON 2026 · V2 — Secure import_shortlisted_teams RPC
-- Adds explicit authorization to prevent privilege escalation.
-- The function remains SECURITY DEFINER so that authorized users
-- can bypass RLS, but it now verifies that the caller is either
-- using the service_role key or explicitly passes public.is_admin().

begin;

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
  -- ── 0. Authorization Check ──────────────────────────────────────────────────
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  -- ── 1. Input Validation ─────────────────────────────────────────────────────
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

    -- Validate team_id
    if coalesce(length(trim(r->>'team_id')), 0) = 0 then
      raise exception 'Row %: team_id is required', row_num using errcode = '22023';
    end if;

    -- Validate registration_source
    if (r->>'registration_source') not in ('WEBSITE', 'UNSTOP') then
      raise exception 'Row %: registration_source must be WEBSITE or UNSTOP (got "%")',
        row_num, r->>'registration_source' using errcode = '22023';
    end if;

    -- Validate team_name
    if coalesce(length(trim(r->>'team_name')), 0) = 0 then
      raise exception 'Row %: team_name is required', row_num using errcode = '22023';
    end if;

    -- Validate team_lead_name
    if coalesce(length(trim(r->>'team_lead_name')), 0) = 0 then
      raise exception 'Row %: team_lead_name is required', row_num using errcode = '22023';
    end if;

    -- Validate contact
    if coalesce(length(trim(r->>'contact')), 0) = 0 then
      raise exception 'Row %: contact is required', row_num using errcode = '22023';
    end if;

    -- Validate email (NEW)
    email_val := trim(coalesce(r->>'email', ''));
    if coalesce(length(email_val), 0) = 0 then
      raise exception 'Row %: email is required', row_num using errcode = '22023';
    end if;
    
    if email_val !~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$' then
      raise exception 'Row %: email must be valid (got "%")', row_num, email_val using errcode = '22023';
    end if;

    -- Validate team_size
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

    -- Validate amount
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

    -- Validate payment_status
    if (r->>'payment_status') <> 'PENDING' then
      raise exception 'Row %: payment_status must be PENDING on import (got "%")',
        row_num, r->>'payment_status' using errcode = '22023';
    end if;

    -- ── UPSERT — insert new, update non-payment fields on conflict ──────────
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
      email               = excluded.email,
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
