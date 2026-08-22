-- Migration: 0021_team_credential_secrets.sql
begin;

create table if not exists public.team_credential_secrets (
  id uuid primary key default gen_random_uuid(),
  team_id text not null unique references public.shortlisted_teams(team_id),
  encrypted_password text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS strictly for service-role access (no policies for anon/authenticated)
alter table public.team_credential_secrets enable row level security;

commit;
