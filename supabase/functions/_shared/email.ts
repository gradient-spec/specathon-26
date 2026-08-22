export const DEFAULT_SHORTLISTED_EMAIL_TEMPLATE = {
  subject: "Congratulations! {{team_name}} has been shortlisted for SPECATHON 2026",
  html: `<p>Hello {{team_lead_name}},</p>
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
Gradient Technical Club</p>`
};

export function generateShortlistedEmail(replacements: Record<string, string>) {
  let { subject, html } = DEFAULT_SHORTLISTED_EMAIL_TEMPLATE;

  for (const [tokenStr, val] of Object.entries(replacements)) {
    subject = subject.split(tokenStr).join(val);
    html = html.split(tokenStr).join(val);
  }

  return { subject, html };
}

export async function sendEmailViaResend(
  resendApiKey: string,
  to: string[],
  subject: string,
  html: string,
  from = "SPECATHON <noreply@gradientclub.in>"
) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html
    })
  });

  const resendData = await res.json();

  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${JSON.stringify(resendData)}`);
  }

  return resendData;
}
