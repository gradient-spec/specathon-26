-- SPECATHON 2026 · V2 — payment_events table
-- Creates the immutable audit log for every payment-related event.
--
-- Scope:
--   • Creates public.payment_events with all columns, constraints, FK, and RLS.
--   • References public.shortlisted_teams(id) created in migration 0007.
--   • Does NOT touch any V1 tables (teams, team_members, admins, audit_log).
--   • Does NOT create policies, triggers, or seed data.
--     Those are implemented in later migrations.
--
-- Business rules enforced here:
--   • Rows are append-only — no UPDATE or DELETE policies will ever be added.
--   • Multiple events per shortlisted_team are allowed (one row per action).
--   • The full Razorpay payload is stored in `payload` for forensic replay.
--
-- Idempotent. Safe to re-run.

begin;

create table if not exists public.payment_events (

  -- ── Identity ──────────────────────────────────────────────────────────────
  id                    uuid        primary key default gen_random_uuid(),

  -- ── Relationship ──────────────────────────────────────────────────────────
  -- Links every event back to the team it belongs to.
  -- ON DELETE RESTRICT: prevents accidental removal of a shortlisted team
  -- while payment evidence still exists for it.
  shortlisted_team_id   uuid        not null
                                    references public.shortlisted_teams (id)
                                    on delete restrict,

  -- ── Razorpay identifiers ──────────────────────────────────────────────────
  -- Nullable because ORDER_CREATED events exist before a payment_id is known,
  -- and WEBHOOK_RECEIVED events may arrive before the order is fully resolved.
  razorpay_order_id     text,
  razorpay_payment_id   text,

  -- ── Event classification ──────────────────────────────────────────────────
  event_type            text        not null
                                    constraint payment_events_event_type_check
                                    check (event_type in (
                                      'ORDER_CREATED',
                                      'PAYMENT_SUCCESS',
                                      'PAYMENT_FAILED',
                                      'PAYMENT_REFUNDED',
                                      'WEBHOOK_RECEIVED'
                                    )),

  -- ── Financials ────────────────────────────────────────────────────────────
  -- Amount in INR (integer, e.g. 500 = ₹500).
  -- NOT NULL: every event must record the amount it was associated with,
  -- even if the payment ultimately failed.
  amount                integer     not null,

  -- ── Payload ───────────────────────────────────────────────────────────────
  -- Complete raw event payload from Razorpay (order object, webhook body, etc).
  -- Stored as JSONB for indexability and forensic audit replay.
  -- NOT NULL: an event with no payload has no audit value.
  payload               jsonb       not null default '{}'::jsonb,

  -- ── Verification ─────────────────────────────────────────────────────────
  -- Result of HMAC-SHA256 signature verification on the Razorpay webhook body.
  -- NULL means verification was not attempted (e.g. ORDER_CREATED, outbound events).
  -- TRUE = signature matched. FALSE = signature mismatch (potential tampering).
  signature_verified    boolean,

  -- ── Audit ─────────────────────────────────────────────────────────────────
  created_at            timestamptz not null default now()

);

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Enabled now; policies will be added in a later migration.
-- No policy = deny all for non-owner roles (append-only intent enforced
-- by never granting UPDATE or DELETE in future policies).
alter table public.payment_events enable row level security;

commit;
