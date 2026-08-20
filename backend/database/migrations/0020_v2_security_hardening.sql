-- SPECATHON 2026 - V2 - Security Hardening
-- Creates Easebuzz audit log (legacy Razorpay tables are intentionally preserved for backward compatibility)

begin;

-- Create Easebuzz Audit Log
create table if not exists public.easebuzz_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('SURL_CALLBACK', 'FURL_CALLBACK')),
  easebuzz_txnid text,
  amount integer,
  payload jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

-- RLS Policies
alter table public.easebuzz_audit_log enable row level security;

-- Only admins can select.
-- Insert is done via service_role in the Edge Function.
create policy "Admins can view audit logs"
  on public.easebuzz_audit_log for select
  using (auth.jwt() ->> 'role' = 'admin');

commit;
