-- SPECATHON 2026 - V2 - Phase 1 Team Auth Association
-- Links shortlisted_teams to auth.users for secure session management

begin;

-- Add auth_id reference to associate teams with Supabase Auth users
alter table public.shortlisted_teams
  add column if not exists auth_id uuid unique references auth.users(id) on delete set null;

create index if not exists shortlisted_teams_auth_id_idx on public.shortlisted_teams(auth_id);

-- RLS Policy: Teams can only view their own row based on auth.uid()
create policy "teams_view_own_record"
  on public.shortlisted_teams
  for select
  using (auth.uid() = auth_id);

commit;
