-- SPECATHON 2026 · V2 — Secure import_v2_participants RPC

begin;

create or replace function public.import_v2_participants(
  rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r jsonb;
  row_num int := 0;
  upsert_count int := 0;
  email_val text;
  phone_val text;
begin
  -- ── 1. Admin Verification ──────────────────────────────────────────────────
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_admin() then
    raise exception 'import_v2_participants: Unauthorized' using errcode = '42501';
  end if;

  -- ── 2. Payload Validation ──────────────────────────────────────────────────
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'import_v2_participants: input must be a JSON array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(rows) = 0 then
    raise exception 'import_v2_participants: no rows to import'
      using errcode = '22023';
  end if;

  -- ── 3. Processing Loop ─────────────────────────────────────────────────────
  for r in select * from jsonb_array_elements(rows) loop
    row_num := row_num + 1;

    -- Validate required string fields
    if nullif(trim(r->>'team_id'), '') is null then
      raise exception 'Row %: team_id is required', row_num using errcode = '22023';
    end if;
    if nullif(trim(r->>'member_id'), '') is null then
      raise exception 'Row %: member_id is required', row_num using errcode = '22023';
    end if;
    if nullif(trim(r->>'member_name'), '') is null then
      raise exception 'Row %: member_name is required', row_num using errcode = '22023';
    end if;

    -- Optional fields
    email_val := nullif(trim(r->>'email'), '');
    phone_val := nullif(trim(r->>'phone'), '');

    -- ── UPSERT ──────────────────────────────────────────────────────────────
    -- We assume the foreign key constraint on team_id handles validating the team exists.
    insert into public.v2_participants (
      team_id,
      member_id,
      member_name,
      email,
      phone
    ) values (
      trim(r->>'team_id'),
      trim(r->>'member_id'),
      trim(r->>'member_name'),
      email_val,
      phone_val
    )
    on conflict (team_id, member_id) do update set
      member_name = excluded.member_name,
      email       = excluded.email,
      phone       = excluded.phone;

    upsert_count := upsert_count + 1;
  end loop;

  return jsonb_build_object(
    'imported', upsert_count,
    'timestamp', now()
  );
end;
$$;

-- ── 4. Grants ────────────────────────────────────────────────────────────────
revoke all on function public.import_v2_participants(jsonb) from public;
grant  execute on function public.import_v2_participants(jsonb) to service_role;
grant  execute on function public.import_v2_participants(jsonb) to authenticated;

commit;
