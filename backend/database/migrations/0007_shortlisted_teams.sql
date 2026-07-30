-- SPECATHON 2026 · V2 — shortlisted_teams table
-- Creates the source of truth for the V2 payment workflow.
--
-- Scope:
--   • Creates public.shortlisted_teams with all columns, constraints, and RLS.
--   • Does NOT touch any V1 tables (teams, team_members, admins, audit_log).
--   • Does NOT create policies, triggers, indexes beyond uniqueness, or seed data.
--     Those are implemented in later migrations.
--
-- Idempotent. Safe to re-run.

begin;

create table if not exists public.shortlisted_teams (

  -- ── Identity ─────────────────────────────────────────────────────────────
  id              uuid        primary key default gen_random_uuid(),

  -- Human-readable team identifier (e.g. SPEC2026-0042).
  -- Sourced either from the V1 reg_code (WEBSITE) or assigned during
  -- CSV import (UNSTOP). Must be unique across both sources.
  team_id         text        not null,

  -- ── Source ───────────────────────────────────────────────────────────────
  -- Tracks whether this team registered via the website or Unstop.
  registration_source text    not null
                              constraint shortlisted_teams_registration_source_check
                              check (registration_source in ('WEBSITE', 'UNSTOP')),

  -- ── Team details ─────────────────────────────────────────────────────────
  team_name       text        not null,
  team_lead_name  text        not null,
  contact         text        not null,

  team_size       integer     not null
                              constraint shortlisted_teams_team_size_check
                              check (team_size between 2 and 4),

  -- ── Payment ──────────────────────────────────────────────────────────────
  -- Final payable amount in INR (paise-free integer, e.g. 500 = ₹500).
  -- Nullable until the admin confirms the amount during CSV import or review.
  amount          integer,

  payment_status  text        not null default 'PENDING'
                              constraint shortlisted_teams_payment_status_check
                              check (payment_status in ('PENDING', 'FAILED', 'PAID')),

  -- Free-text notes from admins (e.g. waiver reason, manual override).
  payment_notes   text,

  -- Populated by the payment webhook once payment is confirmed as PAID.
  paid_at         timestamptz,

  -- ── Audit ────────────────────────────────────────────────────────────────
  created_at      timestamptz not null default now()

);

-- ── Uniqueness ───────────────────────────────────────────────────────────────
-- team_id is the stable external identifier; must be globally unique.
-- This also acts as the index for lookups by team_id.
alter table public.shortlisted_teams
  add constraint shortlisted_teams_team_id_key unique (team_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Enabled now; policies will be added in a later migration once the
-- admin auth flow for V2 is defined.
alter table public.shortlisted_teams enable row level security;

commit;
