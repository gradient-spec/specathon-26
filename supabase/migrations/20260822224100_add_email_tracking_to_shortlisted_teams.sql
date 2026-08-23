begin;

-- 1. Add shortlisted email tracking columns to shortlisted_teams
alter table public.shortlisted_teams
  add column if not exists shortlisted_email_status text not null default 'NOT_SENT',
  add column if not exists shortlisted_email_sent_at timestamptz,
  add column if not exists shortlisted_email_message_id text,
  add column if not exists shortlisted_email_error text;

-- 2. Add validation constraint for the status
alter table public.shortlisted_teams
  drop constraint if exists shortlisted_teams_email_status_check;

alter table public.shortlisted_teams
  add constraint shortlisted_teams_email_status_check
  check (shortlisted_email_status in ('NOT_SENT', 'SENDING', 'SENT', 'FAILED'));

commit;
