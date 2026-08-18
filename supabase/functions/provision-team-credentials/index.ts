import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
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
    auth:    { persistSession: false, autoRefreshToken: false },
    global:  { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

function generateSecurePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "aA1!";
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  const accessToken = extractBearer(req);
  if (!accessToken) {
    return json({ success: false, message: "Authorization header is required." }, 401);
  }

  try {
    const userClient = createUserClient(accessToken);
    const { data: isAdmin, error } = await userClient.rpc("is_admin");
    if (error) throw new Error(error.message);
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }
  } catch (err) {
    console.error("[provision-team] admin check failed:", err);
    return json({ success: false, message: "Authorization check failed." }, 500);
  }

  let teamId: string;
  try {
    const body = await req.json() as { teamId?: string };
    teamId = (body.teamId ?? "").trim().toUpperCase();
  } catch {
    return json({ success: false, message: "Request body must be JSON with a teamId field." }, 400);
  }

  if (!teamId) {
    return json({ success: false, message: "teamId is required." }, 400);
  }

  const serviceClient = createServiceClient();

  // Check if team exists and is unprovisioned
  const { data: teamData, error: teamErr } = await serviceClient
    .from("shortlisted_teams")
    .select("auth_id")
    .eq("team_id", teamId)
    .maybeSingle();

  if (teamErr) {
    console.error("[provision-team] DB error:", teamErr);
    return json({ success: false, message: "Database lookup failed." }, 500);
  }

  if (!teamData) {
    return json({ success: false, message: "Team not found." }, 404);
  }

  if (teamData.auth_id) {
    return json({ success: false, message: "Credentials already provisioned for this team." }, 409);
  }

  const password = generateSecurePassword();
  const email = `${teamId.toLowerCase()}@teams.specathon.in`;

  // Create Auth User
  const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    console.error("[provision-team] create user error:", authErr);
    return json({ success: false, message: "Failed to create authentication credentials." }, 500);
  }

  const newUserId = authData.user.id;

  // Bind to shortlisted_teams concurrently
  // We use an UPDATE with a WHERE clause that strictly requires auth_id IS NULL.
  // We cannot use the standard Supabase JS `update()` and rely on its error code for concurrent modifications
  // if no rows were found, so we must check how many rows were updated. 
  // Supabase postgREST can return the updated row using `.select()`.
  
  const { data: updateData, error: updateErr } = await serviceClient
    .from("shortlisted_teams")
    .update({ auth_id: newUserId })
    .eq("team_id", teamId)
    .is("auth_id", null)
    .select();

  if (updateErr) {
    console.error("[provision-team] update binding error:", updateErr);
    await serviceClient.auth.admin.deleteUser(newUserId);
    return json({ success: false, message: "Failed to bind credentials to team." }, 500);
  }

  if (!updateData || updateData.length === 0) {
    // Zero rows updated. This means a concurrent request beat us to it, or the team was deleted.
    console.warn(`[provision-team] Concurrent provisioning detected for ${teamId}. Rolling back.`);
    await serviceClient.auth.admin.deleteUser(newUserId);
    return json({ success: false, message: "Credentials already provisioned for this team." }, 409);
  }

  return json({
    success: true,
    teamId,
    password,
  });
});

