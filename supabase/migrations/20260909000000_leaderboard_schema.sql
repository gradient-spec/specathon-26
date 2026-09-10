-- ═══════════════════════════════════════════════════════════════════════
-- SPECATHON 2026 · Live Leaderboard schema  (port of the standalone
-- Express + MySQL "specathon-2026-leaderboard" app onto Supabase Postgres)
-- ═══════════════════════════════════════════════════════════════════════
-- Public read (anon) for the live display; all writes go through is_admin()
-- (the same allowlist the rest of the admin dashboard uses) — either via
-- RLS on the venue-group tables or via the SECURITY DEFINER RPCs below,
-- which keep the score + audit write atomic and stamp changed_by from the
-- caller's JWT.
--
-- All object names are prefixed `leaderboard_` to avoid colliding with the
-- existing V1 `teams` / registration tables.
--
-- Idempotent-ish: guarded with IF NOT EXISTS / DROP ... IF EXISTS so it is
-- safe to re-run against a fresh project.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Tables ────────────────────────────────────────────────────────

create table if not exists public.leaderboard_teams (
  id         bigint generated always as identity primary key,
  team_id    text        not null,
  team_name  text        not null,
  venue      text        not null default 'TBD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaderboard_teams_team_id_key unique (team_id)
);
create index if not exists leaderboard_teams_venue_idx on public.leaderboard_teams (venue);

create table if not exists public.leaderboard_scores (
  id           bigint generated always as identity primary key,
  team_id      bigint      not null references public.leaderboard_teams (id) on delete cascade,
  round1_score int,
  round2_score int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint leaderboard_scores_team_key       unique (team_id),
  constraint leaderboard_scores_round1_non_neg check (round1_score is null or round1_score >= 0),
  constraint leaderboard_scores_round2_non_neg check (round2_score is null or round2_score >= 0)
);

create table if not exists public.leaderboard_event_settings (
  id               int primary key default 1 constraint leaderboard_event_settings_singleton check (id = 1),
  current_stage    text not null default 'ROUND_1_UPCOMING'
                     constraint leaderboard_event_settings_stage_check check (current_stage in (
                       'ROUND_1_UPCOMING','ROUND_1_LIVE','ROUND_1_COMPLETED',
                       'ROUND_2_UPCOMING','ROUND_2_LIVE','ROUND_2_COMPLETED',
                       'FINAL_UPCOMING','FINAL_LIVE','FINAL_COMPLETED','RESULTS_LIVE'
                     )),
  round1_max_score int     not null default 40,
  round2_max_score int     not null default 40,
  auto_advance     boolean not null default true,
  round1_start_at  timestamptz,
  round1_end_at    timestamptz,
  round2_start_at  timestamptz,
  round2_end_at    timestamptz,
  final_start_at   timestamptz,
  final_end_at     timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists public.leaderboard_venue_groups (
  id         bigint generated always as identity primary key,
  group_name text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leaderboard_venue_groups_name_key unique (group_name)
);

create table if not exists public.leaderboard_venue_group_members (
  id         bigint generated always as identity primary key,
  group_id   bigint not null references public.leaderboard_venue_groups (id) on delete cascade,
  venue_name text   not null,
  constraint leaderboard_venue_group_members_key unique (group_id, venue_name)
);

create table if not exists public.leaderboard_score_audit (
  id         bigint generated always as identity primary key,
  team_id    bigint      not null references public.leaderboard_teams (id) on delete cascade,
  round      text        not null constraint leaderboard_score_audit_round_check check (round in ('ROUND_1','ROUND_2')),
  old_score  int,
  new_score  int,
  changed_by text,
  changed_at timestamptz not null default now()
);
create index if not exists leaderboard_score_audit_team_idx on public.leaderboard_score_audit (team_id, changed_at desc);

-- Seed the singleton settings row.
insert into public.leaderboard_event_settings (id) values (1)
on conflict (id) do nothing;

-- Keep updated_at fresh on the tables the admin edits directly.
create or replace function public.leaderboard_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists leaderboard_teams_touch        on public.leaderboard_teams;
drop trigger if exists leaderboard_scores_touch       on public.leaderboard_scores;
drop trigger if exists leaderboard_venue_groups_touch on public.leaderboard_venue_groups;

create trigger leaderboard_teams_touch        before update on public.leaderboard_teams        for each row execute function public.leaderboard_touch_updated_at();
create trigger leaderboard_scores_touch       before update on public.leaderboard_scores       for each row execute function public.leaderboard_touch_updated_at();
create trigger leaderboard_venue_groups_touch before update on public.leaderboard_venue_groups for each row execute function public.leaderboard_touch_updated_at();


-- ─── 2. Realtime ─────────────────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.leaderboard_teams;          exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.leaderboard_scores;         exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.leaderboard_event_settings; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.leaderboard_venue_groups;   exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.leaderboard_venue_group_members; exception when duplicate_object then null; end;
end $$;


-- ─── 3. Row Level Security ───────────────────────────────────────────
-- Public read for everything the live display needs; admin-only writes.
-- The audit table is admin-read-only (no anon).

alter table public.leaderboard_teams               enable row level security;
alter table public.leaderboard_scores              enable row level security;
alter table public.leaderboard_event_settings      enable row level security;
alter table public.leaderboard_venue_groups        enable row level security;
alter table public.leaderboard_venue_group_members enable row level security;
alter table public.leaderboard_score_audit         enable row level security;

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
     where schemaname = 'public' and tablename like 'leaderboard_%'
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Public SELECT
create policy "lb public read teams"    on public.leaderboard_teams               for select to anon, authenticated using (true);
create policy "lb public read scores"   on public.leaderboard_scores              for select to anon, authenticated using (true);
create policy "lb public read settings" on public.leaderboard_event_settings      for select to anon, authenticated using (true);
create policy "lb public read groups"   on public.leaderboard_venue_groups        for select to anon, authenticated using (true);
create policy "lb public read members"  on public.leaderboard_venue_group_members for select to anon, authenticated using (true);

-- Admin full access
create policy "lb admin all teams"    on public.leaderboard_teams               for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lb admin all scores"   on public.leaderboard_scores              for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lb admin all settings" on public.leaderboard_event_settings      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lb admin all groups"   on public.leaderboard_venue_groups        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lb admin all members"  on public.leaderboard_venue_group_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "lb admin read audit"   on public.leaderboard_score_audit         for select to authenticated using (public.is_admin());

grant select on
  public.leaderboard_teams,
  public.leaderboard_scores,
  public.leaderboard_event_settings,
  public.leaderboard_venue_groups,
  public.leaderboard_venue_group_members
to anon, authenticated;

grant select, insert, update, delete on
  public.leaderboard_teams,
  public.leaderboard_scores,
  public.leaderboard_event_settings,
  public.leaderboard_venue_groups,
  public.leaderboard_venue_group_members,
  public.leaderboard_score_audit
to authenticated;


-- ─── 4. Schedule-derived stage (pure, mirrors server/schedule.ts) ────
-- Returns the stage implied by the configured round times, or NULL when the
-- schedule can't decide (Round 1 has no start) — callers keep the manual stage.
create or replace function public.leaderboard_scheduled_stage(s public.leaderboard_event_settings)
returns text
language plpgsql
stable
as $$
declare
  now_ts       timestamptz := now();
  last_completed text := null;
begin
  -- Round 1
  if s.round1_start_at is null then return last_completed; end if;
  if now_ts < s.round1_start_at then return 'ROUND_1_UPCOMING'; end if;
  if s.round1_end_at is not null and now_ts >= s.round1_end_at then
    last_completed := 'ROUND_1_COMPLETED';
  else
    return 'ROUND_1_LIVE';
  end if;

  -- Round 2
  if s.round2_start_at is null then return last_completed; end if;
  if now_ts < s.round2_start_at then return 'ROUND_2_UPCOMING'; end if;
  if s.round2_end_at is not null and now_ts >= s.round2_end_at then
    last_completed := 'ROUND_2_COMPLETED';
  else
    return 'ROUND_2_LIVE';
  end if;

  -- Final
  if s.final_start_at is null then return last_completed; end if;
  if now_ts < s.final_start_at then return 'FINAL_UPCOMING'; end if;
  if s.final_end_at is not null and now_ts >= s.final_end_at then
    return 'FINAL_COMPLETED';
  else
    return 'FINAL_LIVE';
  end if;
end;
$$;

-- Persist the schedule-derived stage when auto-advance has moved past the
-- stored value. Safe to call from the public page on load (idempotent).
create or replace function public.leaderboard_tick_stage()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  s       public.leaderboard_event_settings;
  derived text;
begin
  select * into s from public.leaderboard_event_settings where id = 1;
  if not found then return null; end if;
  if s.auto_advance is not true then return s.current_stage; end if;

  derived := public.leaderboard_scheduled_stage(s);
  if derived is not null and derived <> s.current_stage then
    update public.leaderboard_event_settings
       set current_stage = derived, updated_at = now()
     where id = 1;
    return derived;
  end if;
  return s.current_stage;
end;
$$;

revoke all on function public.leaderboard_tick_stage() from public;
grant execute on function public.leaderboard_tick_stage() to anon, authenticated;


-- ─── 5. Admin RPCs (atomic score + audit, roster import) ─────────────

-- Upsert one round score and write the audit row in a single transaction.
create or replace function public.leaderboard_set_score(
  p_team_id   bigint,
  p_round     text,
  p_new_score int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor     text := coalesce(auth.jwt() ->> 'email', 'admin');
  old_score int;
  max_score int;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_round not in ('ROUND_1','ROUND_2') then
    raise exception 'round must be ROUND_1 or ROUND_2' using errcode = '22023';
  end if;
  if p_new_score is null or p_new_score < 0 then
    raise exception 'score must be >= 0' using errcode = '22023';
  end if;

  select case when p_round = 'ROUND_1' then round1_max_score else round2_max_score end
    into max_score from public.leaderboard_event_settings where id = 1;
  if max_score is not null and p_new_score > max_score then
    raise exception 'score must be between 0 and %', max_score using errcode = '22023';
  end if;

  select case when p_round = 'ROUND_1' then round1_score else round2_score end
    into old_score from public.leaderboard_scores where team_id = p_team_id;

  if p_round = 'ROUND_1' then
    insert into public.leaderboard_scores (team_id, round1_score) values (p_team_id, p_new_score)
    on conflict (team_id) do update set round1_score = excluded.round1_score;
  else
    insert into public.leaderboard_scores (team_id, round2_score) values (p_team_id, p_new_score)
    on conflict (team_id) do update set round2_score = excluded.round2_score;
  end if;

  insert into public.leaderboard_score_audit (team_id, round, old_score, new_score, changed_by)
  values (p_team_id, p_round, old_score, p_new_score, actor);

  return jsonb_build_object('oldScore', old_score, 'newScore', p_new_score, 'maximum', max_score);
end;
$$;

-- Clear one round score (set to NULL) + audit.
create or replace function public.leaderboard_clear_score(
  p_team_id bigint,
  p_round   text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor     text := coalesce(auth.jwt() ->> 'email', 'admin');
  old_score int;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_round not in ('ROUND_1','ROUND_2') then
    raise exception 'round must be ROUND_1 or ROUND_2' using errcode = '22023';
  end if;

  select case when p_round = 'ROUND_1' then round1_score else round2_score end
    into old_score from public.leaderboard_scores where team_id = p_team_id;

  if old_score is null then
    return jsonb_build_object('oldScore', null, 'newScore', null);
  end if;

  if p_round = 'ROUND_1' then
    update public.leaderboard_scores set round1_score = null where team_id = p_team_id;
  else
    update public.leaderboard_scores set round2_score = null where team_id = p_team_id;
  end if;

  insert into public.leaderboard_score_audit (team_id, round, old_score, new_score, changed_by)
  values (p_team_id, p_round, old_score, null, actor);

  return jsonb_build_object('oldScore', old_score, 'newScore', null);
end;
$$;

-- Upsert a roster from the Excel import. Existing team_ids are updated
-- (name + venue); scores are never touched. Returns the row count.
create or replace function public.leaderboard_import_teams(rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r      jsonb;
  n      int := 0;
  v_id   text;
  v_name text;
  v_ven  text;
begin
  if not public.is_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(rows) <> 'array' then
    raise exception 'rows must be a JSON array' using errcode = '22023';
  end if;

  for r in select * from jsonb_array_elements(rows)
  loop
    v_id   := upper(trim(r->>'teamId'));
    v_name := trim(r->>'teamName');
    v_ven  := upper(nullif(trim(coalesce(r->>'venue','')), ''));
    if coalesce(length(v_id), 0) = 0 then
      raise exception 'row %: teamId is required', n + 1 using errcode = '22023';
    end if;
    if coalesce(length(v_name), 0) = 0 then
      raise exception 'row %: teamName is required', n + 1 using errcode = '22023';
    end if;

    insert into public.leaderboard_teams (team_id, team_name, venue)
    values (v_id, v_name, coalesce(v_ven, 'TBD'))
    on conflict (team_id) do update
      set team_name = excluded.team_name,
          venue     = excluded.venue;
    n := n + 1;
  end loop;

  return jsonb_build_object('count', n);
end;
$$;

revoke all on function public.leaderboard_set_score(bigint, text, int)   from public;
revoke all on function public.leaderboard_clear_score(bigint, text)      from public;
revoke all on function public.leaderboard_import_teams(jsonb)            from public;
grant execute on function public.leaderboard_set_score(bigint, text, int)   to authenticated;
grant execute on function public.leaderboard_clear_score(bigint, text)      to authenticated;
grant execute on function public.leaderboard_import_teams(jsonb)            to authenticated;

commit;
