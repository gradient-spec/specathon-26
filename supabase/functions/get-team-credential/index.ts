import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { decryptPassword } from "../_shared/crypto.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, x-client-info, authorization",
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
    auth:    { persistSession: false, autoRefreshToken: false },
    global:  { headers: { Authorization: `Bearer ${accessToken}` } },
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
    const { teamId } = await req.json();
    if (!teamId || typeof teamId !== "string") {
      return json({ success: false, message: "Invalid teamId." }, 400);
    }

    const userClient = createUserClient(token);
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    
    if (adminErr || !adminCheck) {
      console.error("[get-team-credential] Admin check failed:", adminErr);
      return json({ success: false, message: "Unauthorized." }, 403);
    }

    const serviceClient = createServiceClient();
    
    const { data: secretRow, error: secretErr } = await serviceClient
      .from("team_credential_secrets")
      .select("encrypted_password")
      .eq("team_id", teamId)
      .maybeSingle();

    if (secretErr) {
      console.error(`[get-team-credential] Error fetching secret for ${teamId}:`, secretErr);
      return json({ success: false, message: "Database lookup failed." }, 500);
    }

    if (!secretRow || !secretRow.encrypted_password) {
      return json({ success: false, message: "Credential not found." }, 404);
    }

    let password = "";
    try {
      password = await decryptPassword(secretRow.encrypted_password);
    } catch (err: any) {
      console.error(`[get-team-credential] Decryption failed for ${teamId}:`, err);
      return json({ success: false, message: "Failed to decrypt credential." }, 500);
    }

    return json({ success: true, password });
  } catch (err: any) {
    console.error("[get-team-credential] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
