import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

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
    const userClient = createUserClient(token);

    // Allow both service role (no user, but valid token) and admin users.
    // However, to keep it simple and consistent with existing functions:
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }

    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !adminCheck) {
      console.error("[send-email] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-email] Missing RESEND_API_KEY environment variable.");
      return json({ success: false, message: "Email service is not configured." }, 500);
    }

    const body = await req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return json({ success: false, message: "Missing required fields: to, subject, html." }, 400);
    }

    // Ensure 'to' is an array of strings for consistency
    const toArray = Array.isArray(to) ? to : [to];

    // Send email using Resend HTTP API directly
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "SPECATHON <noreply@gradientclub.in>",
        to: toArray,
        subject: subject,
        html: html
      })
    });

    const resendData = await res.json();

    if (!res.ok) {
      console.error(`[send-email] Resend API error: ${res.status}`, resendData);
      return json({ success: false, message: "Failed to send email via provider." }, 502);
    }

    return json({
      success: true,
      message: "Email sent successfully.",
      data: resendData
    });

  } catch (err: any) {
    console.error("[send-email] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
