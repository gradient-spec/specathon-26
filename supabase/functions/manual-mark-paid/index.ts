import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import * as QRCode from "npm:qrcode";

// Assuming _shared/email.ts provides these utilities
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
    console.error("[manual-mark-paid] Missing RESEND_API_KEY.");
    return json({ success: false, message: "Email service is not configured." }, 500);
  }

  try {
    const { team_id, resend } = await req.json();
    if (!team_id || typeof team_id !== "string") {
      return json({ success: false, message: "Invalid team_id." }, 400);
    }

    const isResend = Boolean(resend);

    // 1. Authenticate admin
    const userClient = createUserClient(token);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !adminCheck) {
      console.error("[manual-mark-paid] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const serviceClient = createServiceClient();

    // 1b. Validate eligibility
    const { data: currentTeam, error: teamCheckErr } = await serviceClient
      .from("shortlisted_teams")
      .select("payment_status, payment_email_status, email")
      .eq("team_id", team_id)
      .maybeSingle();

    if (teamCheckErr || !currentTeam) {
      return json({ success: false, message: "Team not found." }, 404);
    }

    if (!currentTeam.email) {
      return json({ success: false, message: "Team has no email address." }, 400);
    }

    if (currentTeam.payment_email_status === "SENDING") {
      return json({ success: false, message: "Payment email is currently being sent." }, 400);
    }

    if (isResend) {
      if (currentTeam.payment_status !== "PAID") {
        return json({ success: false, message: "Cannot resend payment email for an unpaid team." }, 400);
      }
      if (currentTeam.payment_email_status !== "SENT" && currentTeam.payment_email_status !== "FAILED" && currentTeam.payment_email_status !== "NOT_SENT") {
        return json({ success: false, message: "Can only resend if status is SENT, FAILED, or NOT_SENT." }, 400);
      }
    } else {
      if (currentTeam.payment_status === "PAID") {
        return json({ success: false, message: "Team is already PAID. Use resend if you need to send the email again." }, 400);
      }
    }

    // 2. ATOMIC CLAIM
    const validStatuses = isResend ? ["SENT", "FAILED", "NOT_SENT"] : ["NOT_SENT", "FAILED"];

    // We do the DB update immediately for payment status AND atomic claim for email
    const updatePayload: any = {
      payment_email_status: "SENDING",
      payment_email_error: null,
    };

    if (!isResend) {
      updatePayload.payment_status = "PAID";
      updatePayload.paid_at = new Date().toISOString();
    }

    const { data: claimedRow, error: claimErr } = await serviceClient
      .from("shortlisted_teams")
      .update(updatePayload)
      .eq("team_id", team_id)
      .in("payment_email_status", validStatuses)
      .select("team_id, team_name, team_lead_name, email")
      .maybeSingle();

    if (claimErr) {
      console.error(`[manual-mark-paid] Atomic claim error for ${team_id}:`, claimErr);
      return json({ success: false, message: "Database claim failed." }, 500);
    }

    if (!claimedRow) {
      return json({ success: false, message: "Database claim failed (possibly concurrent update)." }, 400);
    }

    // Function to handle failure securely
    const markFailed = async (errMsg: string, safeMsg: string) => {
      console.error(`[manual-mark-paid] Failing email for team ${team_id}: ${errMsg}`);
      await serviceClient
        .from("shortlisted_teams")
        .update({ payment_email_status: "FAILED", payment_email_error: safeMsg })
        .eq("team_id", team_id);
      return json({ success: false, message: safeMsg }, 500);
    };

    // 3. Fetch Participants
    const { data: participants, error: partsErr } = await serviceClient
      .from("v2_participants")
      .select("member_id, member_name")
      .eq("team_id", team_id)
      .order("member_id", { ascending: true });

    if (partsErr) {
      return markFailed(partsErr.message, "Failed to retrieve participant data.");
    }
    
    if (!participants || participants.length === 0) {
      return markFailed("No participants found", "No participants imported for this team. Generate QR failed.");
    }

    // 4. Generate QRs
    const attachments: { filename: string; content: string }[] = [];
    let qrHtmlBlock = "";

    try {
      for (const p of participants) {
        const qrPayload = `${team_id}-${p.member_id}`;
        // Generate base64 PNG
        const base64DataUrl = await QRCode.toDataURL(qrPayload, {
          margin: 1,
          width: 300,
          color: { dark: "#000000", light: "#ffffff" }
        });
        
        // Strip out the "data:image/png;base64," prefix for Resend attachment
        const base64Content = base64DataUrl.replace(/^data:image\/png;base64,/, "");
        const cid = `qr-${p.member_id}`;
        const filename = `QR_${team_id}_${p.member_id}.png`;

        attachments.push({ filename, content: base64Content, content_id: cid });

        qrHtmlBlock += `
<div style="margin-bottom: 24px; text-align: center;">
  <img src="cid:${cid}" alt="QR Code for ${p.member_name}" style="width: 200px; height: 200px; display: block; margin: 0 auto; border: 1px solid #eee; border-radius: 8px;">
  <p style="margin-top: 12px; font-weight: bold; font-size: 16px;">Member Name: ${p.member_name}</p>
</div>
`;
      }
    } catch (qrErr: any) {
      return markFailed(qrErr.message, "Failed to generate QR codes.");
    }

    // 5. Fetch Template & Generate Email
    let template;
    try {
      const { data: tmplData, error: tmplErr } = await serviceClient
        .from("email_templates")
        .select("subject, html")
        .eq("template_key", "payment_confirmation")
        .single();
      
      if (tmplErr || !tmplData) {
        throw new Error("Template payment_confirmation not found in DB.");
      }
      template = tmplData;
    } catch (err: any) {
      return markFailed(err.message, "Failed to retrieve payment_confirmation template.");
    }

    // Replace the << >> placeholders
    const { subject, html } = generateShortlistedEmail(
      template.subject,
      template.html,
      {
        "<<Team Lead Name>>": claimedRow.team_lead_name,
        "<<Team Name>>": claimedRow.team_name,
        "<<Team ID>>": claimedRow.team_id,
        "&lt;&lt;Team Lead Name&gt;&gt;": claimedRow.team_lead_name,
        "&lt;&lt;Team Name&gt;&gt;": claimedRow.team_name,
        "&lt;&lt;Team ID&gt;&gt;": claimedRow.team_id
      }
    );

    // Append the QR HTML blocks at the bottom of the email or just before the regards if possible.
    // For simplicity, we just inject it before the last few paragraphs or simply append it.
    // Wait, the template already has: "These QR codes are attached to this email... Please ensure that..."
    // Let's replace a specific placeholder if we want, or just append it to the end before the "We strongly recommend..."
    
    // A robust way to insert it: find "<p>Please ensure that:</p>" and insert before it.
    const splitPoint = "<p>Please ensure that:</p>";
    let finalHtml = html;
    if (html.includes(splitPoint)) {
      finalHtml = html.replace(splitPoint, `${qrHtmlBlock}<br/>${splitPoint}`);
    } else {
      finalHtml += `<br/>${qrHtmlBlock}`;
    }

    // 6. Send Email
    let resendData;
    try {
      resendData = await sendEmailViaResend(resendApiKey, [claimedRow.email], subject, finalHtml, "SPECATHON <noreply@gradientclub.in>", attachments);
    } catch (err: any) {
      return markFailed(err.message, "Failed to send email via provider.");
    }

    // 7. Update to SENT
    await serviceClient
      .from("shortlisted_teams")
      .update({
        payment_email_status: "SENT",
        payment_email_sent_at: new Date().toISOString(),
        payment_email_message_id: resendData.id || "unknown"
      })
      .eq("team_id", team_id);

    return json({
      success: true,
      message: "Payment marked as PAID and confirmation email sent successfully."
    });

  } catch (err: any) {
    console.error("[manual-mark-paid] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
