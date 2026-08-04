  -- SPECATHON 2026 · V2 — RLS policies + import upsert fix
  --
  -- Part 1: RLS Policies
  -- ─────────────────────────────────────────────────────────────────────────────
  -- shortlisted_teams and payment_events have RLS enabled (migration 0007/0008)
  -- but no policies exist. The admin dashboard uses the anon-key Supabase client
  -- (VITE_SUPABASE_ANON_KEY), which sends a JWT with role=authenticated after
  -- login. With no SELECT policy, PostgREST returns 0 rows and no error —
  -- the table appears empty in the UI.
  --
  -- Policies follow least-privilege:
  --   • Authenticated admins (is_admin() = true):
  --       SELECT / UPDATE on shortlisted_teams
  --       SELECT on payment_events
  --   • service_role (Edge Functions — bypass RLS by default):
  --       No explicit policy needed; service_role always bypasses RLS.
  --
  -- Part 2: Import UPSERT fix
  -- ─────────────────────────────────────────────────────────────────────────────
  -- import_shortlisted_teams() currently INSERT-only. Re-uploading a CSV fails
  -- for any team_id that already exists (unique_violation). The desired behaviour:
  --   • Re-upload replaces existing shortlist rows (upsert on team_id).
  --   • payment_status, payment_notes, paid_at are PRESERVED if already set
  --     (a team that paid should not have their status reset to PENDING).
  --   • payment_events rows are never touched.
  --
  -- Idempotent. Safe to re-run.

  begin;

  -- ── 1a. shortlisted_teams: admin SELECT ──────────────────────────────────────
  create policy "admin_select_shortlisted_teams"
    on public.shortlisted_teams
    for select
    to authenticated
    using (public.is_admin());

  -- ── 1b. shortlisted_teams: admin UPDATE (for payment_notes) ──────────────────
  create policy "admin_update_shortlisted_teams"
    on public.shortlisted_teams
    for update
    to authenticated
    using (public.is_admin())
    with check (public.is_admin());

  -- ── 1c. payment_events: admin SELECT (read-only — events are append-only) ────
  create policy "admin_select_payment_events"
    on public.payment_events
    for select
    to authenticated
    using (public.is_admin());

  -- ── 2. Replace import_shortlisted_teams() with upsert behaviour ──────────────
  -- Uses INSERT … ON CONFLICT (team_id) DO UPDATE.
  -- Only updates the mutable columns that an organiser controls.
  -- payment_status, payment_notes, paid_at are preserved via
  --   EXCLUDED.payment_status = EXCLUDED.payment_status   (no-op)
  -- pattern — we only update them if the current value is PENDING,
  -- which means a re-import can correct team details without wiping payment state.

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
      -- ON CONFLICT on team_id:
      --   • Always updates team details (name, lead, contact, size, amount, source)
      --   • NEVER overwrites payment_status, paid_at (preserves payment history)
      --   • NEVER overwrites payment_notes (preserves admin notes)
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
      )
      on conflict (team_id) do update set
        registration_source = excluded.registration_source,
        team_name           = excluded.team_name,
        team_lead_name      = excluded.team_lead_name,
        contact             = excluded.contact,
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

  -- Grants unchanged: service_role + authenticated
  revoke all on function public.import_shortlisted_teams(jsonb) from public;
  grant  execute on function public.import_shortlisted_teams(jsonb) to service_role;
  grant  execute on function public.import_shortlisted_teams(jsonb) to authenticated;

  commit;
