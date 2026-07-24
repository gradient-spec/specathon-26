-- SPECATHON 2026 · Registration schema
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  team_name     text not null,
  leader_name   text not null,
  email         text not null,
  phone         text not null,
  college       text not null,
  team_size     int  not null check (team_size between 1 and 5),
  domain        text not null,
  github        text,
  linkedin      text
);

create index if not exists teams_created_at_idx on public.teams (created_at desc);
create index if not exists teams_email_idx      on public.teams (email);

create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  name       text not null,
  email      text,
  role       text,
  created_at timestamptz not null default now()
);

create index if not exists team_members_team_idx on public.team_members (team_id);

-- Row-level security: policies are defined in migrations/0001_rls_policies.sql.
-- Run that file after this one (or any time you need to re-apply policies).
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

-- Admin-friendly export view. Query and download from the Supabase table editor as CSV,
-- or export to .xlsx with any SQL client.
create or replace view public.registrations_export as
select
  t.id             as team_id,
  t.created_at     as registered_at,
  t.team_name,
  t.leader_name,
  t.email,
  t.phone,
  t.college,
  t.team_size,
  t.domain,
  t.github,
  t.linkedin,
  coalesce(
    string_agg(m.name || case when m.email is not null then ' <' || m.email || '>' else '' end, ' | '),
    ''
  ) as members
from public.teams t
left join public.team_members m on m.team_id = t.id
group by t.id
order by t.created_at desc;
