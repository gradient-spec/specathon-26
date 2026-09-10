-- SPECATHON 2026 · Migration 0022: Hackathon Event Timer & Timeline
-- Authoritative tables for event clock, metro-timeline checkpoints,
-- real-time synchronization, and server time calibration RPC.

begin;

-- ── 1. Timer Configuration Table ──────────────────────────────────────
create table if not exists public.timer_config (
  id          integer primary key default 1 check (id = 1),
  name        text not null default 'SPECATHON 2026',
  start_at    timestamptz not null default '2026-09-11T09:00:00+05:30',
  end_at      timestamptz not null default '2026-09-12T21:00:00+05:30',
  status      text not null check (status in ('draft', 'scheduled', 'running', 'paused', 'completed')) default 'scheduled',
  paused_remaining_seconds integer default 129600,
  timezone    text not null default 'Asia/Kolkata',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text default 'system'
);

-- Ensure backwards-compatible columns & constraints if table exists
alter table public.timer_config drop constraint if exists timer_config_status_check;
alter table public.timer_config add constraint timer_config_status_check check (status in ('draft', 'scheduled', 'running', 'paused', 'completed'));
alter table public.timer_config add column if not exists paused_remaining_seconds integer default 129600;

insert into public.timer_config (id, name, start_at, end_at, status, paused_remaining_seconds, timezone, updated_by)
values (
  1,
  'SPECATHON 2026',
  '2026-09-11T09:00:00+05:30',
  '2026-09-12T21:00:00+05:30',
  'scheduled',
  129600,
  'Asia/Kolkata',
  'system'
)
on conflict (id) do update set
  paused_remaining_seconds = coalesce(public.timer_config.paused_remaining_seconds, 129600);

-- ── 2. Timer Events / Checkpoints Table ────────────────────────────────
create table if not exists public.timer_events (
  id          uuid primary key default gen_random_uuid(),
  timer_id    integer not null references public.timer_config(id) on delete cascade default 1,
  title       text not null,
  description text default '',
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  location    text default '',
  type        text not null check (type in ('milestone', 'evaluation', 'mentoring', 'break', 'submission', 'general')) default 'milestone',
  sort_order  integer not null default 0,
  is_visible  boolean not null default true,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text default 'system',
  constraint timer_events_time_order check (end_at >= start_at)
);

create index if not exists timer_events_start_at_idx on public.timer_events(start_at, sort_order);
create index if not exists timer_events_completed_idx on public.timer_events(is_completed, sort_order);

do $$
begin
  if not exists (select 1 from public.timer_events limit 1) then
    insert into public.timer_events (title, description, start_at, end_at, location, type, sort_order) values
      ('Reporting Time', 'Team reporting, badging, and kit collection.', '2026-09-11T08:30:00+05:30', '2026-09-11T09:30:00+05:30', 'Main Auditorium', 'milestone', 10),
      ('Inaugural', 'Opening keynote, problem statements, and rules briefing.', '2026-09-11T09:30:00+05:30', '2026-09-11T10:30:00+05:30', 'Main Auditorium', 'milestone', 20),
      ('Commencement of Hackathon', 'Official start of development. Clock is live!', '2026-09-11T10:30:00+05:30', '2026-09-11T11:30:00+05:30', 'Hacking Arena', 'milestone', 30),
      ('Round 1 Evaluation', 'First evaluation checkpoint: Architecture and ideation check.', '2026-09-11T11:30:00+05:30', '2026-09-11T13:30:00+05:30', 'Evaluation Bays', 'evaluation', 40),
      ('Lunch', 'Lunch break for all hackathon participants.', '2026-09-11T13:30:00+05:30', '2026-09-11T14:30:00+05:30', 'Dining Hall', 'break', 50),
      ('Short Break', 'Quick rest, snacks, and networking.', '2026-09-11T17:30:00+05:30', '2026-09-11T18:00:00+05:30', 'Cafeteria', 'break', 60),
      ('Dinner', 'Dinner served across campus dining halls.', '2026-09-11T20:00:00+05:30', '2026-09-11T21:00:00+05:30', 'Dining Hall', 'break', 70),
      ('Mentorship / Internal Evaluation', 'Mentors review prototypes and technical architecture.', '2026-09-11T21:30:00+05:30', '2026-09-11T23:30:00+05:30', 'Hacking Arena', 'mentoring', 80),
      ('Campfire with Jamming session', 'Midnight campfire, acoustic music, and chill session.', '2026-09-12T00:00:00+05:30', '2026-09-12T01:00:00+05:30', 'Open Amphitheatre', 'break', 90),
      ('Refresh', 'Morning recharge and wash-up time.', '2026-09-12T06:00:00+05:30', '2026-09-12T07:30:00+05:30', 'Campus Hostels', 'break', 100),
      ('Breakfast', 'Hot breakfast and coffee/tea served.', '2026-09-12T07:30:00+05:30', '2026-09-12T08:30:00+05:30', 'Dining Hall', 'break', 110),
      ('Round 2 Evaluation', 'Detailed code review and feature completeness check.', '2026-09-12T10:00:00+05:30', '2026-09-12T13:00:00+05:30', 'Evaluation Bays', 'evaluation', 120),
      ('Lunch', 'Day 2 lunch buffet.', '2026-09-12T13:00:00+05:30', '2026-09-12T14:00:00+05:30', 'Dining Hall', 'break', 130),
      ('Final Evaluation', 'Grand jury stage presentations and live project testing.', '2026-09-12T14:30:00+05:30', '2026-09-12T16:30:00+05:30', 'Main Stage', 'evaluation', 140),
      ('Valedictory & Vote of Thanks', 'Awards ceremony, winner declarations, and closing ceremony.', '2026-09-12T16:30:00+05:30', '2026-09-12T17:30:00+05:30', 'Main Auditorium', 'milestone', 150);
  end if;
end $$;

-- ── 3. Server Time Calibration RPC ────────────────────────────────────
create or replace function public.get_server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

-- Clean up redundant timer_audit_log if previously created (audits use existing public.audit_log)
drop table if exists public.timer_audit_log cascade;

-- ── 4. Row-Level Security (RLS) ───────────────────────────────────────
alter table public.timer_config enable row level security;
alter table public.timer_events enable row level security;

-- timer_config policies
drop policy if exists "public_read_timer_config" on public.timer_config;
create policy "public_read_timer_config"
  on public.timer_config for select
  using (true);

drop policy if exists "admin_all_timer_config" on public.timer_config;
create policy "admin_all_timer_config"
  on public.timer_config for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- timer_events policies
drop policy if exists "public_read_timer_events" on public.timer_events;
create policy "public_read_timer_events"
  on public.timer_events for select
  using (is_visible = true or (auth.role() = 'authenticated' and public.is_admin()));

drop policy if exists "admin_all_timer_events" on public.timer_events;
create policy "admin_all_timer_events"
  on public.timer_events for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── 5. Grant Permissions ──────────────────────────────────────────────
grant select on public.timer_config to anon, authenticated;
grant all on public.timer_config to authenticated;

grant select on public.timer_events to anon, authenticated;
grant all on public.timer_events to authenticated;

grant execute on function public.get_server_time() to anon, authenticated;

-- ── 6. Realtime Publication ───────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.timer_config;
exception when others then
  null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.timer_events;
exception when others then
  null;
end $$;

commit;

