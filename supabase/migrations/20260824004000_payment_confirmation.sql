-- SPECATHON 2026 · V2 — Payment Confirmation Schema

begin;

-- 1. Create v2_participants table
create table if not exists public.v2_participants (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.shortlisted_teams(team_id) on delete cascade,
  member_id text not null,
  member_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  unique(team_id, member_id)
);

-- Enable RLS (Service Role can always access)
alter table public.v2_participants enable row level security;

-- 2. Add email tracking for payment confirmations to shortlisted_teams
alter table public.shortlisted_teams
  add column if not exists payment_email_status text not null default 'NOT_SENT',
  add column if not exists payment_email_sent_at timestamptz,
  add column if not exists payment_email_message_id text,
  add column if not exists payment_email_error text;

alter table public.shortlisted_teams
  add constraint shortlisted_teams_payment_email_status_check
  check (payment_email_status in ('NOT_SENT', 'SENDING', 'SENT', 'FAILED'));

-- 3. Insert payment_confirmation email template
insert into public.email_templates (template_key, subject, html)
values (
  'payment_confirmation',
  'SPECATHON 2026 Payment Confirmed — team <<Team Name>> is Officially On Board!',
  '<p>Dear &lt;&lt;Team Lead Name&gt;&gt;,</p>
<p><br></p>
<p>Greetings from Team Gradient!</p>
<p><br></p>
<p>We are delighted to confirm that we have successfully received and verified your team''s payment for SPECATHON 2026.</p>
<p><br></p>
<p>Your team, <strong>&lt;&lt;Team Name&gt;&gt;</strong> (Team ID: <strong>&lt;&lt;Team ID&gt;&gt;</strong>), has now officially secured its spot and is confirmed to participate in the SPECATHON-2026.</p>
<p><br></p>
<p>Thank you for completing the payment process. We''re thrilled to have your team join us for SPECATHON 2026, taking place on 11th &amp; 12th September 2026 at St. Peter''s Engineering College, Hyderabad.</p>
<p><br></p>
<p>Further details regarding reporting time, event schedule, accommodation, guidelines, and other event-related information will be communicated through the volunteer assigned to your team, who will be your primary point of contact throughout the hackathon.</p>
<p><br></p>
<p>As part of your team''s confirmation, we have generated a unique QR code for each registered team member. These QR codes are attached to this email for your team''s use during SPECATHON 2026.</p>
<p><br></p>
<p>Each QR code is individually assigned to a specific participant and will be used for participant identification and attendance marking at the event.</p>
<p><br></p>
<p>Please ensure that:</p>
<ul>
  <li>Every team member receives their respective QR code.</li>
  <li>The QR codes are kept safely until the event.</li>
  <li>Each participant carries their QR code with them when reporting at the venue.</li>
  <li>Do not share or exchange QR codes between team members, as each QR code is uniquely assigned to one participant.</li>
</ul>
<p><br></p>
<p>We strongly recommend keeping the QR codes readily accessible on your mobile device. You may also save the QR codes offline or print them as a backup.</p>
<p><br></p>
<p>Please note: The QR codes are required for attendance/participant verification at the venue.</p>
<p><br></p>
<p>If you have any questions, feel free to reach out to us.</p>
<p><br></p>
<p>Congratulations once again!</p>
<p><br></p>
<p>Warm regards,</p>
<p><br></p>
<p>Team Gradient Club<br>
Technical Club – CSE (AI &amp; ML) Department<br>
St. Peter''s Engineering College, Hyderabad</p>'
)
on conflict (template_key) do update
set subject = excluded.subject, html = excluded.html;

commit;
