import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

  const token = extractBearer(req);
  if (!token) return json({ success: false, message: "Missing or invalid token." }, 401);

  try {
    // Authenticate admin
    const userClient = createUserClient(token);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !adminCheck) {
      console.error("[admin-email-template] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const serviceClient = createServiceClient();

    // Using a URL object to parse query parameters easily
    const url = new URL(req.url);
    const templateKey = url.searchParams.get("key") || "shortlisted_team";

    if (templateKey !== "shortlisted_team") {
      return json({ success: false, message: "Invalid template key. Only 'shortlisted_team' is supported." }, 400);
    }

    if (req.method === "GET") {
      const { data, error } = await serviceClient
        .from("email_templates")
        .select("subject, html")
        .eq("template_key", templateKey)
        .maybeSingle();

      if (error) {
        console.error("[admin-email-template] GET error:", error);
        return json({ success: false, message: "Database query failed." }, 500);
      }

      if (!data) {
        return json({ success: false, message: "Template not found." }, 404);
      }

      return json({ success: true, template: data });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { subject, html } = body;

      if (!subject || typeof subject !== "string" || !html || typeof html !== "string") {
        return json({ success: false, message: "Invalid payload. Requires 'subject' and 'html'." }, 400);
      }

      // Basic validation for required tokens in the template
      const requiredTokens = ["{{team_lead_name}}", "{{team_name}}", "{{team_id}}", "{{password}}"];
      const missingTokens = requiredTokens.filter(t => !html.includes(t));

      if (missingTokens.length > 0) {
        return json({
          success: false,
          message: `Template is missing required tokens: ${missingTokens.join(", ")}`
        }, 400);
      }

      const { data, error } = await serviceClient
        .from("email_templates")
        .upsert({
          template_key: templateKey,
          subject,
          html,
          updated_at: new Date().toISOString(),
          updated_by: user.id
        }, { onConflict: "template_key" })
        .select("subject, html")
        .single();

      if (error) {
        console.error("[admin-email-template] POST error:", error);
        return json({ success: false, message: "Database upsert failed." }, 500);
      }

      return json({ success: true, message: "Template updated successfully.", template: data });
    }

    return json({ success: false, message: "Method not allowed." }, 405);

  } catch (err: any) {
    console.error("[admin-email-template] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
