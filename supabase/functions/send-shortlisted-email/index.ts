import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { decryptPassword } from "../_shared/crypto.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const DEFAULT_SHORTLISTED_EMAIL_TEMPLATE = {
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function createUserClient(accessToken: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  const token = extractBearer(req);
  if (!token) return json({ success: false, message: "Missing or invalid token." }, 401);

  try {
    const { team_id } = await req.json();
    if (!team_id || typeof team_id !== "string") {
      return json({ success: false, message: "Invalid team_id." }, 400);
    }

    // 1. Authenticate admin
    const userClient = createUserClient(token);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !adminCheck) {
      console.error("[send-shortlisted-email] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const serviceClient = createServiceClient();

    // 2. Load shortlisted team details
    const { data: teamRow, error: teamErr } = await serviceClient
      .from("shortlisted_teams")
      .select("team_id, team_name, team_lead_name, email")
      .eq("team_id", team_id)
      .maybeSingle();

    if (teamErr) {
      console.error(`[send-shortlisted-email] DB lookup failed for team ${team_id}:`, teamErr);
      return json({ success: false, message: "Database lookup failed." }, 500);
    }
    if (!teamRow) {
      return json({ success: false, message: "Team not found in shortlisted_teams." }, 404);
    }
    if (!teamRow.email) {
      return json({ success: false, message: "Team has no email address configured." }, 400);
    }

    // 3. Load encrypted credential
    const { data: secretRow, error: secretErr } = await serviceClient
      .from("team_credential_secrets")
      .select("encrypted_password")
      .eq("team_id", team_id)
      .maybeSingle();

    if (secretErr) {
      console.error(`[send-shortlisted-email] Error fetching secret for ${team_id}:`, secretErr);
      return json({ success: false, message: "Database lookup failed." }, 500);
    }
    if (!secretRow || !secretRow.encrypted_password) {
      return json({ success: false, message: "Credentials not found. Provision credentials for this team first." }, 404);
    }

    // 4. Decrypt password securely server-side
    let decryptedPassword = "";
    try {
      decryptedPassword = await decryptPassword(secretRow.encrypted_password);
    } catch (err: any) {
      console.error(`[send-shortlisted-email] Decryption failed for ${team_id}:`, err);
      return json({ success: false, message: "Failed to decrypt credential." }, 500);
    }

    // Username convention based on provisioning implementation
    const username = teamRow.team_id;

    // 5. Build the final email strings
    let { subject, html } = DEFAULT_SHORTLISTED_EMAIL_TEMPLATE;
    
    const replacements: Record<string, string> = {
      "{{team_lead_name}}": teamRow.team_lead_name,
      "{{team_name}}": teamRow.team_name,
      "{{team_id}}": teamRow.team_id,
      "{{username}}": username,
      "{{password}}": decryptedPassword
    };

    for (const [tokenStr, val] of Object.entries(replacements)) {
      // replace all instances
      subject = subject.split(tokenStr).join(val);
      html = html.split(tokenStr).join(val);
    }

    // 6. Call Resend API directly
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-shortlisted-email] Missing RESEND_API_KEY environment variable.");
      return json({ success: false, message: "Email service is not configured." }, 500);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "SPECATHON <noreply@gradientclub.in>",
        to: [teamRow.email],
        subject: subject,
        html: html
      })
    });

    const resendData = await res.json();

    if (!res.ok) {
      console.error(`[send-shortlisted-email] Resend API error: ${res.status}`, resendData);
      return json({ success: false, message: "Failed to send email via provider." }, 502);
    }

    // Return ONLY safe metadata
    return json({
      success: true,
      message: "Shortlisted email sent successfully."
    });

  } catch (err: any) {
    console.error("[send-shortlisted-email] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
