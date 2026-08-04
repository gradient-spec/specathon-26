/**
 * SPECATHON 2026 · V2 — Payment Confirmation Email Template
 *
 * Produces the responsive HTML email sent to team leads after payment is
 * verified. All wording is fixed per the product spec — only the three
 * dynamic fields (team_name, team_lead_name, registration_id) are interpolated.
 */

export interface ConfirmationEmailParams {
  teamName:       string;
  teamLeadName:   string;
  registrationId: string;
  toEmail:        string;
}

export function buildConfirmationEmail(p: ConfirmationEmailParams): {
  subject: string;
  html:    string;
  text:    string;
} {
  const subject = `SPECATHON 2026 Payment Confirmed — Team ${p.teamName} is Officially On Board!`;

  const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0; mso-table-rspace: 0; border-collapse: collapse; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    a { text-decoration: none; }

    body {
      background-color: #05060A;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #EDEDED;
      margin: 0;
      padding: 0;
      width: 100%;
    }

    .email-wrapper {
      background-color: #05060A;
      padding: 40px 20px;
      width: 100%;
    }

    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #0E1117;
      border: 1px solid #2A3647;
      border-radius: 16px;
      overflow: hidden;
    }

    /* Header */
    .header {
      background: linear-gradient(135deg, #0B0F14 0%, #121820 50%, #0B0F14 100%);
      border-bottom: 1px solid #2A3647;
      padding: 36px 40px 28px;
      text-align: center;
    }

    .header-logos {
      margin-bottom: 24px;
    }

    .logo-divider {
      display: inline-block;
      color: #4ACBEB;
      font-size: 18px;
      font-weight: 300;
      margin: 0 12px;
      vertical-align: middle;
    }

    .event-name {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
      color: #EDEDED;
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.2;
    }

    .event-name span {
      color: #4ACBEB;
      font-style: italic;
    }

    .event-subtitle {
      font-size: 12px;
      color: #829580;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-top: 8px;
      font-family: 'Courier New', Courier, monospace;
    }

    /* Success banner */
    .success-banner {
      background: linear-gradient(90deg, rgba(74,203,235,0.08) 0%, rgba(74,203,235,0.04) 100%);
      border-top: 2px solid #4ACBEB;
      padding: 24px 40px;
      text-align: center;
    }

    .success-icon {
      font-size: 40px;
      line-height: 1;
      margin-bottom: 12px;
    }

    .success-title {
      font-size: 20px;
      font-weight: 700;
      color: #4ACBEB;
      letter-spacing: -0.02em;
    }

    /* Body */
    .body-content {
      padding: 36px 40px;
    }

    .greeting {
      font-size: 16px;
      color: #EDEDED;
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .body-text {
      font-size: 15px;
      color: #A0ADB8;
      line-height: 1.75;
      margin-bottom: 20px;
    }

    /* Team info card */
    .info-card {
      background-color: #131B27;
      border: 1px solid #2A3647;
      border-left: 3px solid #4ACBEB;
      border-radius: 12px;
      padding: 20px 24px;
      margin: 28px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(42, 54, 71, 0.6);
      font-size: 14px;
    }

    .info-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .info-label {
      color: #829580;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      white-space: nowrap;
      padding-right: 16px;
    }

    .info-value {
      color: #EDEDED;
      font-weight: 600;
      text-align: right;
    }

    .info-value.accent {
      color: #4ACBEB;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      letter-spacing: 0.1em;
    }

    /* Event details */
    .event-details {
      background-color: rgba(74, 203, 235, 0.04);
      border: 1px solid rgba(74, 203, 235, 0.15);
      border-radius: 12px;
      padding: 20px 24px;
      margin: 28px 0;
      text-align: center;
    }

    .event-date {
      font-size: 18px;
      font-weight: 700;
      color: #EDEDED;
      margin-bottom: 6px;
    }

    .event-venue {
      font-size: 13px;
      color: #829580;
      line-height: 1.5;
    }

    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid #2A3647;
      margin: 28px 0;
    }

    /* Footer */
    .footer {
      background-color: #0B0F14;
      border-top: 1px solid #2A3647;
      padding: 28px 40px;
      text-align: center;
    }

    .footer-org {
      font-size: 14px;
      font-weight: 700;
      color: #EDEDED;
      margin-bottom: 4px;
    }

    .footer-sub {
      font-size: 12px;
      color: #829580;
      line-height: 1.6;
    }

    .footer-divider {
      border: none;
      border-top: 1px solid #2A3647;
      margin: 20px auto;
      max-width: 200px;
    }

    .footer-note {
      font-size: 11px;
      color: #4A5568;
      margin-top: 16px;
    }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-wrapper { padding: 20px 12px; }
      .header        { padding: 28px 24px 20px; }
      .success-banner{ padding: 20px 24px; }
      .body-content  { padding: 28px 24px; }
      .footer        { padding: 24px; }
      .event-name    { font-size: 22px; }
      .info-row      { flex-direction: column; align-items: flex-start; gap: 4px; }
      .info-value    { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-container">

      <!-- Header -->
      <div class="header">
        <div class="header-logos">
          <span style="font-size:13px; color:#829580; letter-spacing:0.15em; text-transform:uppercase; font-family:'Courier New',monospace;">SPECATHON</span>
          <span class="logo-divider">×</span>
          <span style="font-size:13px; color:#829580; letter-spacing:0.15em; text-transform:uppercase; font-family:'Courier New',monospace;">GRADIENT</span>
        </div>
        <div class="event-name">SPECATHON <span>2026</span></div>
        <div class="event-subtitle">36-Hour National Level Hackathon</div>
      </div>

      <!-- Success Banner -->
      <div class="success-banner">
        <div class="success-icon">✓</div>
        <div class="success-title">Payment Confirmed</div>
      </div>

      <!-- Body -->
      <div class="body-content">

        <p class="greeting">Dear <strong>${p.teamLeadName}</strong>,</p>

        <p class="body-text">
          Greetings from Team Gradient!
        </p>

        <p class="body-text">
          We are delighted to confirm that we have successfully received and verified your team's
          payment for SPECATHON 2026.
        </p>

        <!-- Team Info Card -->
        <div class="info-card">
          <div class="info-row">
            <span class="info-label">Team Name</span>
            <span class="info-value">${p.teamName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Team ID</span>
            <span class="info-value accent">${p.registrationId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Status</span>
            <span class="info-value" style="color:#4ACBEB;">✓ Confirmed</span>
          </div>
        </div>

        <p class="body-text">
          Your team, <strong>${p.teamName}</strong> (Team ID: <strong>${p.registrationId}</strong>),
          has now officially secured its spot and is confirmed to participate in the
          36-Hour National Level Hackathon.
        </p>

        <!-- Event Details -->
        <div class="event-details">
          <div class="event-date">11th &amp; 12th September 2026</div>
          <div class="event-venue">
            St. Peter's Engineering College<br />
            Hyderabad, Telangana
          </div>
        </div>

        <p class="body-text">
          Thank you for completing the payment process. We're thrilled to have your team join us
          for SPECATHON 2026.
        </p>

        <p class="body-text">
          Further details regarding reporting time, event schedule, accommodation, guidelines,
          and everything you need to know before the hackathon will be shared with you in the
          coming days.
        </p>

        <p class="body-text">
          If you have any questions, feel free to reach out to us.
        </p>

        <hr class="divider" />

        <p class="body-text">
          Congratulations once again! We can't wait to welcome <strong>${p.teamName}</strong>
          to an unforgettable 36 hours of innovation, collaboration, and problem-solving.
        </p>

        <p class="body-text" style="margin-bottom: 0;">
          Warm regards,<br />
          <strong style="color:#EDEDED;">Team Gradient Club</strong>
        </p>

      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-org">Gradient Club</div>
        <div class="footer-sub">
          Technical Club – CSE (AI &amp; ML) Department<br />
          St. Peter's Engineering College, Hyderabad.
        </div>
        <hr class="footer-divider" />
        <div class="footer-note">
          This email was sent to ${p.toEmail} because your team registered for SPECATHON 2026.<br />
          Please do not reply to this email.
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;

  const text = `Dear ${p.teamLeadName},

Greetings from Team Gradient!

We are delighted to confirm that we have successfully received and verified your team's payment for SPECATHON 2026.

Your team, ${p.teamName} (Team ID: ${p.registrationId}), has now officially secured its spot and is confirmed to participate in the 36-Hour National Level Hackathon.

Thank you for completing the payment process. We're thrilled to have your team join us for SPECATHON 2026, taking place on 11th & 12th September 2026 at St. Peter's Engineering College, Hyderabad.

Further details regarding reporting time, event schedule, accommodation, guidelines, and everything you need to know before the hackathon will be shared with you in the coming days.

If you have any questions, feel free to reach out to us.

Congratulations once again! We can't wait to welcome ${p.teamName} to an unforgettable 36 hours of innovation, collaboration, and problem-solving.

Warm regards,
Team Gradient Club
Technical Club – CSE (AI & ML) Department
St. Peter's Engineering College, Hyderabad.`;

  return { subject, html, text };
}
