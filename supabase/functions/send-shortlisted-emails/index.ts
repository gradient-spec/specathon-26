import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { decryptPassword } from "../_shared/crypto.ts";
import { getShortlistedEmailTemplate, generateShortlistedEmail, sendEmailViaResend } from "../_shared/email.ts";

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

// Bounded concurrency helper
async function mapConcurrent<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  };

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);

  return results;
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
    console.error("[send-shortlisted-emails] Missing RESEND_API_KEY.");
    return json({ success: false, message: "Email service is not configured." }, 500);
  }

  try {
    const { team_ids } = await req.json();
    if (!team_ids || !Array.isArray(team_ids) || team_ids.length === 0) {
      return json({ success: false, message: "Invalid team_ids. Must be a non-empty array." }, 400);
    }

    // 1. Authenticate admin
    const userClient = createUserClient(token);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !adminCheck) {
      console.error("[send-shortlisted-emails] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const serviceClient = createServiceClient();

    // Fetch the template once for the whole batch
    let template;
    try {
      template = await getShortlistedEmailTemplate(serviceClient);
    } catch (err: any) {
      console.error("[send-shortlisted-emails] Failed to retrieve template:", err);
      return json({ success: false, message: "Failed to retrieve email template." }, 500);
    }

    // The inner worker function to process one team
    const processTeam = async (team_id: string) => {
      // Helper to safely fail this team without crashing the batch
      const markFailed = async (errMsg: string, safeMsg: string) => {
        console.error(`[send-shortlisted-emails] Failing team ${team_id}: ${errMsg}`);
        await serviceClient
          .from("shortlisted_teams")
          .update({ shortlisted_email_status: "FAILED", shortlisted_email_error: safeMsg })
          .eq("team_id", team_id);
        return { team_id, success: false, error: safeMsg };
      };

      try {
        // 1. ATOMIC CLAIM
        const { data: claimedRow, error: claimErr } = await serviceClient
          .from("shortlisted_teams")
          .update({ shortlisted_email_status: "SENDING", shortlisted_email_error: null })
          .eq("team_id", team_id)
          .in("shortlisted_email_status", ["NOT_SENT", "FAILED"])
          .not("email", "is", null)
          .select("team_id, team_name, team_lead_name, email")
          .maybeSingle();

        if (claimErr) {
          return await markFailed(claimErr.message, "Database claim failed.");
        }
        if (!claimedRow) {
          // E.g., already sent, missing email, or concurrent claim won
          return { team_id, success: false, error: "Team not eligible or already in progress." };
        }

        // 2. Load encrypted credential
        const { data: secretRow, error: secretErr } = await serviceClient
          .from("team_credential_secrets")
          .select("encrypted_password")
          .eq("team_id", team_id)
          .maybeSingle();

        if (secretErr) {
          return await markFailed(secretErr.message, "Database lookup failed for credentials.");
        }
        if (!secretRow || !secretRow.encrypted_password) {
          return await markFailed("Credentials not found", "Credentials not found. Provision credentials for this team first.");
        }

        // 3. Decrypt password securely server-side
        let decryptedPassword = "";
        try {
          decryptedPassword = await decryptPassword(secretRow.encrypted_password);
        } catch (err: any) {
          return await markFailed(err.message, "Failed to decrypt credential.");
        }

        const username = claimedRow.team_id;

        // 4. Generate HTML
        const { subject, html } = generateShortlistedEmail(
          template.subject,
          template.html,
          {
            "{{team_lead_name}}": claimedRow.team_lead_name,
            "{{team_name}}": claimedRow.team_name,
            "{{team_id}}": claimedRow.team_id,
            "{{username}}": username,
            "{{password}}": decryptedPassword
          }
        );

        // 5. Send Email
        let resendData;
        try {
          resendData = await sendEmailViaResend(resendApiKey, [claimedRow.email], subject, html);
        } catch (err: any) {
          return await markFailed(err.message, "Failed to send email via provider.");
        }

        // 6. Update to SENT
        await serviceClient
          .from("shortlisted_teams")
          .update({
            shortlisted_email_status: "SENT",
            shortlisted_email_sent_at: new Date().toISOString(),
            shortlisted_email_message_id: resendData.id || "unknown"
          })
          .eq("team_id", team_id);

        return { team_id, success: true };

      } catch (err: any) {
        return await markFailed(err.message || "Unknown error", "Unexpected error processing team.");
      }
    };

    // Run bounded concurrency processing (3 concurrent workers)
    const results = await mapConcurrent(team_ids, 3, processTeam);

    const sent = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return json({
      success: true,
      total: team_ids.length,
      sent,
      failed,
      results
    });

  } catch (err: any) {
    console.error("[send-shortlisted-emails] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
