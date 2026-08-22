import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { decryptPassword } from "../_shared/crypto.ts";
import { generateShortlistedEmail, sendEmailViaResend } from "../_shared/email.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
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

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("[send-shortlisted-email] Missing RESEND_API_KEY.");
    return json({ success: false, message: "Email service is not configured." }, 500);
  }

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

    // 2. ATOMIC CLAIM
    const { data: claimedRow, error: claimErr } = await serviceClient
      .from("shortlisted_teams")
      .update({ shortlisted_email_status: "SENDING", shortlisted_email_error: null })
      .eq("team_id", team_id)
      .in("shortlisted_email_status", ["NOT_SENT", "FAILED"])
      .not("email", "is", null)
      .select("team_id, team_name, team_lead_name, email")
      .maybeSingle();

    if (claimErr) {
      console.error(`[send-shortlisted-email] Atomic claim error for ${team_id}:`, claimErr);
      return json({ success: false, message: "Database claim failed." }, 500);
    }

    if (!claimedRow) {
      // It was either already sent, sending, doesn't exist, or has no email
      return json({ success: false, message: "Team not eligible for email sending or already in progress." }, 400);
    }

    // Function to handle failure securely
    const markFailed = async (errMsg: string, safeMsg: string) => {
      console.error(`[send-shortlisted-email] Failing team ${team_id}: ${errMsg}`);
      await serviceClient
        .from("shortlisted_teams")
        .update({ shortlisted_email_status: "FAILED", shortlisted_email_error: safeMsg })
        .eq("team_id", team_id);
      return json({ success: false, message: safeMsg }, 500);
    };

    // 3. Load encrypted credential
    const { data: secretRow, error: secretErr } = await serviceClient
      .from("team_credential_secrets")
      .select("encrypted_password")
      .eq("team_id", team_id)
      .maybeSingle();

    if (secretErr) {
      return markFailed(secretErr.message, "Database lookup failed for credentials.");
    }
    if (!secretRow || !secretRow.encrypted_password) {
      return markFailed("Credentials not found", "Credentials not found. Provision credentials for this team first.");
    }

    // 4. Decrypt password securely server-side
    let decryptedPassword = "";
    try {
      decryptedPassword = await decryptPassword(secretRow.encrypted_password);
    } catch (err: any) {
      return markFailed(err.message, "Failed to decrypt credential.");
    }

    const username = claimedRow.team_id;

    // 5. Generate email
    const { subject, html } = generateShortlistedEmail({
      "{{team_lead_name}}": claimedRow.team_lead_name,
      "{{team_name}}": claimedRow.team_name,
      "{{team_id}}": claimedRow.team_id,
      "{{username}}": username,
      "{{password}}": decryptedPassword
    });

    // 6. Send email
    let resendData;
    try {
      resendData = await sendEmailViaResend(resendApiKey, [claimedRow.email], subject, html);
    } catch (err: any) {
      return markFailed(err.message, "Failed to send email via provider.");
    }

    // 7. Update to SENT
    await serviceClient
      .from("shortlisted_teams")
      .update({
        shortlisted_email_status: "SENT",
        shortlisted_email_sent_at: new Date().toISOString(),
        shortlisted_email_message_id: resendData.id || "unknown"
      })
      .eq("team_id", team_id);

    return json({
      success: true,
      message: "Shortlisted email sent successfully."
    });

  } catch (err: any) {
    console.error("[send-shortlisted-email] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
