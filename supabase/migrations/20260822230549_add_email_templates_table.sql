-- Create email_templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key text UNIQUE NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Secure it: Only service role can access it, or allow admins (since edge functions use service client, we can just let service role handle it, but we can also add RLS for admins if needed. To be safe and simple, we'll just restrict to service_role/postgres).
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access"
ON public.email_templates
FOR ALL
TO service_role
USING (true);

-- Insert the default shortlisted email template
INSERT INTO public.email_templates (template_key, subject, html)
VALUES (
  'shortlisted_team',
  'Congratulations! {{team_name}} has been shortlisted for SPECATHON 2026',
  '<p>Hello {{team_lead_name}},</p>
<p><br></p>
<p>Congratulations!</p>
<p><br></p>
<p>Your team, <strong>{{team_name}}</strong>, has been shortlisted for SPECATHON 2026.</p>
<p><br></p>
<p>Team ID: <strong>{{team_id}}</strong></p>
<p><br></p>
<p>Your team credentials are:</p>
<p><br></p>
<p>Username: <strong>{{username}}</strong><br>
Password: <strong>{{password}}</strong></p>
<p><br></p>
<p>Please keep these credentials safe. They will be required for the next stage of the SPECATHON process.</p>
<p><br></p>
<p>We look forward to seeing your team at SPECATHON 2026.</p>
<p><br></p>
<p>Regards,<br>
SPECATHON 2026<br>
Gradient Technical Club</p>'
) ON CONFLICT (template_key) DO NOTHING;
