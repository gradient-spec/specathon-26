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
    const userClient = createUserClient(token);
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ success: false, message: "Unauthorized." }, 401);
    }

    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    
    if (adminErr || !adminCheck) {
      console.error("[delete-team-record] Admin check failed:", adminErr);
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }

    const body = await req.json();
    let teamIds: string[] = [];
    if (Array.isArray(body.teamIds)) {
      teamIds = body.teamIds.map((id: string) => id.trim().toUpperCase()).filter(Boolean);
    }

    if (teamIds.length === 0) {
      return json({ success: false, message: "teamIds array is required and must not be empty." }, 400);
    }

    const serviceClient = createServiceClient();
    
    const results = {
      DELETED: [] as string[],
      SKIPPED_PAYMENT_EVENTS: [] as string[],
      FAILED: [] as { teamId: string; error: string }[]
    };

    for (const teamId of teamIds) {
      try {
        // Fetch team details
        const { data: team, error: teamErr } = await serviceClient
          .from("shortlisted_teams")
          .select("id, team_id, auth_id")
          .eq("team_id", teamId)
          .maybeSingle();

        if (teamErr) throw new Error(`Database error fetching team: ${teamErr.message}`);
        if (!team) {
          results.FAILED.push({ teamId, error: "Team not found in shortlisted_teams." });
          continue;
        }

        // Check for payment events
        const { data: payments, error: paymentsErr } = await serviceClient
          .from("payment_events")
          .select("id")
          .eq("shortlisted_team_id", team.id)
          .limit(1);

        if (paymentsErr) throw new Error(`Database error fetching payment_events: ${paymentsErr.message}`);
        if (payments && payments.length > 0) {
          results.SKIPPED_PAYMENT_EVENTS.push(teamId);
          continue;
        }

        // Proceed with deletion safely using serviceClient

        // 1. Delete spin_attempts
        const { error: spinErr } = await serviceClient
          .from("spin_attempts")
          .delete()
          .eq("shortlisted_team_id", team.id);
        if (spinErr) throw new Error(`Failed to delete spin_attempts: ${spinErr.message}`);

        // 2. Delete team_credential_secrets
        const { error: credErr } = await serviceClient
          .from("team_credential_secrets")
          .delete()
          .eq("team_id", team.team_id);
        if (credErr) throw new Error(`Failed to delete team_credential_secrets: ${credErr.message}`);

        // 3. Delete auth.users (if any)
        if (team.auth_id) {
          const { error: authErr } = await serviceClient.auth.admin.deleteUser(team.auth_id);
          if (authErr && (authErr as any).status !== 404) {
            console.warn(`[delete-team-record] Failed to delete auth user for ${teamId}:`, authErr);
          }
        }

        // 4. Delete shortlisted_teams
        const { error: deleteTeamErr } = await serviceClient
          .from("shortlisted_teams")
          .delete()
          .eq("id", team.id);
        
        if (deleteTeamErr) throw new Error(`Failed to delete shortlisted_teams record: ${deleteTeamErr.message}`);

        // 5. Log audit
        await serviceClient.from("audit_log").insert({
          actor: user.id,
          action: "delete",
          target_type: "team",
          target_id: team.team_id,
          meta: { pipeline: "V2", team_id: team.team_id, uuid: team.id }
        });

        results.DELETED.push(teamId);

      } catch (err: any) {
        console.error(`[delete-team-record] Failed for team ${teamId}:`, err);
        results.FAILED.push({ teamId, error: err.message || "Unknown error" });
      }
    }

    return json({ success: true, results });
  } catch (err: any) {
    console.error("[delete-team-record] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
