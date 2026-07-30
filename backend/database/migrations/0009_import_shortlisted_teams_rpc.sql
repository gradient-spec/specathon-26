-- SPECATHON 2026 · V2 — import_shortlisted_teams() RPC
-- Provides a single atomic entry point for bulk-inserting shortlisted teams
-- from the CSV import script. All rows are inserted in one transaction;
-- any failure rolls back the entire batch.
--
-- Scope:
--   • Creates public.import_shortlisted_teams(rows jsonb) → jsonb
--   • Does NOT touch any V1 tables.
--   • Does NOT create policies or triggers.
--
-- Idempotent. Safe to re-run.

begin;

create or replace function public.import_shortlisted_teams(
  rows jsonb   -- array of row objects matching shortlisted_teams columns
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_count  int := 0;
  r          jsonb;
  row_num    int := 0;
  team_size_val   int;
  amount_val      int;
  expected_amount int;
begin
  -- ── Must receive an array ─────────────────────────────────────────────────
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'import_shortlisted_teams: input must be a JSON array'
      using errcode = '22023';
  end if;

  row_count := jsonb_array_length(rows);

  if row_count = 0 then
    raise exception 'import_shortlisted_teams: no rows to import'
      using errcode = '22023';
  end if;

  -- ── Row-level validation and insert ──────────────────────────────────────
  for r in select * from jsonb_array_elements(rows)
  loop
    row_num := row_num + 1;

    -- team_id
    if coalesce(length(trim(r->>'team_id')), 0) = 0 then
      raise exception 'Row %: team_id is required', row_num
        using errcode = '22023';
    end if;

    -- registration_source
    if (r->>'registration_source') not in ('WEBSITE', 'UNSTOP') then
      raise exception 'Row %: registration_source must be WEBSITE or UNSTOP (got "%")',
        row_num, r->>'registration_source'
        using errcode = '22023';
    end if;

    -- team_name
    if coalesce(length(trim(r->>'team_name')), 0) = 0 then
      raise exception 'Row %: team_name is required', row_num
        using errcode = '22023';
    end if;

    -- team_lead_name
    if coalesce(length(trim(r->>'team_lead_name')), 0) = 0 then
      raise exception 'Row %: team_lead_name is required', row_num
        using errcode = '22023';
    end if;

    -- contact
    if coalesce(length(trim(r->>'contact')), 0) = 0 then
      raise exception 'Row %: contact is required', row_num
        using errcode = '22023';
    end if;

    -- team_size
    begin
      team_size_val := (r->>'team_size')::int;
    exception when others then
      raise exception 'Row %: team_size must be an integer (got "%")',
        row_num, r->>'team_size'
        using errcode = '22023';
    end;

    if team_size_val not between 2 and 4 then
      raise exception 'Row %: team_size must be between 2 and 4 (got %)',
        row_num, team_size_val
        using errcode = '22023';
    end if;

    -- amount: must match the fixed rate for team_size
    begin
      amount_val := (r->>'amount')::int;
    exception when others then
      raise exception 'Row %: amount must be an integer (got "%")',
        row_num, r->>'amount'
        using errcode = '22023';
    end;

    expected_amount := case team_size_val
      when 2 then 800
      when 3 then 1200
      when 4 then 1600
    end;

    if amount_val <> expected_amount then
      raise exception 'Row %: amount for team_size % must be % (got %)',
        row_num, team_size_val, expected_amount, amount_val
        using errcode = '22023';
    end if;

    -- payment_status: must be PENDING on import
    if (r->>'payment_status') <> 'PENDING' then
      raise exception 'Row %: payment_status must be PENDING on import (got "%")',
        row_num, r->>'payment_status'
        using errcode = '22023';
    end if;

    -- ── Insert row ──────────────────────────────────────────────────────────
    begin
      insert into public.shortlisted_teams (
        team_id,
        registration_source,
        team_name,
        team_lead_name,
        contact,
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
        team_size_val,
        amount_val,
        'PENDING',
        nullif(trim(coalesce(r->>'payment_notes', '')), '')
      );
    exception
      when unique_violation then
        raise exception 'Row %: team_id "%" is already in shortlisted_teams',
          row_num, trim(r->>'team_id')
          using errcode = '23505';
    end;

  end loop;

  return jsonb_build_object(
    'imported', row_count,
    'status',   'ok'
  );
end;
$$;

-- Only service_role (used by the import script) needs execute access.
-- anon and authenticated get no access — this is an admin-only operation.
revoke all on function public.import_shortlisted_teams(jsonb) from public;
grant  execute on function public.import_shortlisted_teams(jsonb) to service_role;

commit;
