import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { encryptPassword } from "../_shared/crypto.ts";

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

function generateSecurePassword(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 16) + "aA1!";
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
    const { data: adminCheck, error: adminErr } = await userClient.rpc("is_admin");
    
    if (adminErr || !adminCheck) {
      console.error("[bulk-provision-credentials] Admin check failed:", adminErr);
      return json({ success: false, message: "Unauthorized." }, 403);
    }

    const serviceClient = createServiceClient();
    
    // Eligibility: Fetch ALL shortlisted teams.
    const { data: teams, error: fetchErr } = await serviceClient
      .from("shortlisted_teams")
      .select("*")
      .order("team_id", { ascending: true });

    if (fetchErr) {
      throw new Error(`Failed to fetch shortlisted_teams: ${fetchErr.message}`);
    }

    const results = {
      ALREADY_PROVISIONED: [] as string[],
      LEGACY: [] as string[],
      INCONSISTENT: [] as string[],
      PROVISIONED: [] as { teamId: string; password: string }[],
      ORPHANED_AUTH: [] as string[],
      FAILED: [] as string[]
    };

    for (const team of (teams || [])) {
      const teamId = team.team_id;

      try {
        // Fresh Initial Query to avoid stale state
        const { data: freshTeam, error: freshTeamErr } = await serviceClient
          .from("shortlisted_teams")
          .select("auth_id")
          .eq("team_id", teamId)
          .maybeSingle();
        const { data: secretRow, error: secretErr } = await serviceClient
          .from("team_credential_secrets")
          .select("team_id")
          .eq("team_id", teamId)
          .maybeSingle();

        if (freshTeamErr || secretErr) {
          throw new Error(`Fresh query failed: ${freshTeamErr?.message || ''} ${secretErr?.message || ''}`);
        }
        
        if (!freshTeam) {
          throw new Error(`Team not found in shortlisted_teams during fresh query.`);
        }

        const hasAuthId = !!freshTeam.auth_id;
        const hasSecret = !!secretRow;

        // Classification
        if (hasAuthId && hasSecret) {
          results.ALREADY_PROVISIONED.push(teamId);
          continue;
        }

        if (hasAuthId && !hasSecret) {
          results.LEGACY.push(teamId);
          continue; // Do NOT rotate password
        }

        if (!hasAuthId && hasSecret) {
          results.INCONSISTENT.push(teamId);
          continue;
        }

        // CASE B: auth_id is NULL AND secret does NOT exist
        const plainPassword = generateSecurePassword();
        const email = `${teamId.toLowerCase()}@teams.specathon.in`;
        let encryptedPassword = "";
        
        try {
          encryptedPassword = await encryptPassword(plainPassword);
        } catch (e: any) {
          throw new Error(`Encryption failed: ${e.message}`);
        }

        // Attempt Provisioning
        const { data: authData, error: authErr } = await serviceClient.auth.admin.createUser({
          email,
          password: plainPassword,
          email_confirm: true,
        });

        if (authErr) {
          // Concurrency / Orphan Check
          const msg = (authErr.message || "").toLowerCase();
          const isDuplicate = authErr.code === "user_already_exists" || 
                              ((authErr.status === 422 || authErr.status === 400) && 
                               (msg.includes("user already exists") || msg.includes("email address already registered") || msg.includes("user already registered")));
                              
          if (isDuplicate) {
            // Re-query database
            const { data: reCheckTeam, error: reCheckTeamErr } = await serviceClient
              .from("shortlisted_teams")
              .select("auth_id")
              .eq("team_id", teamId)
              .maybeSingle();
            const { data: reCheckSecret, error: reCheckSecretErr } = await serviceClient
              .from("team_credential_secrets")
              .select("team_id")
              .eq("team_id", teamId)
              .maybeSingle();

            if (reCheckTeamErr || reCheckSecretErr) {
              throw new Error(`Collision re-check failed: ${reCheckTeamErr?.message || ''} ${reCheckSecretErr?.message || ''}`);
            }

            const reHasAuth = !!reCheckTeam?.auth_id;
            const reHasSecret = !!reCheckSecret;

            if (reHasAuth && reHasSecret) {
              results.ALREADY_PROVISIONED.push(teamId);
            } else if (reHasAuth && !reHasSecret) {
              results.LEGACY.push(teamId);
            } else if (!reHasAuth && reHasSecret) {
              results.INCONSISTENT.push(teamId);
            } else {
              // Re-check shows auth_id is NULL and no secret, but user already exists in Auth.
              results.ORPHANED_AUTH.push(teamId);
            }
            continue;
          }
          throw new Error(`Auth creation failed: ${authErr.message}`);
        }

        const newUserId = authData.user.id;
        let secretInsertedByUs = false;
        
        // Define explicit rollback helper for this single team
        const rollback = async (reason: string) => {
          let cleanupFailed = false;
          if (secretInsertedByUs) {
            try {
              const { error: delErr } = await serviceClient.from("team_credential_secrets").delete().eq("team_id", teamId);
              if (delErr) throw delErr;
            } catch (e) {
              console.error(`[bulk-provision-credentials] Rollback secret failed for ${teamId}:`, e);
              cleanupFailed = true;
            }
          }
          try {
            const { error: delAuthErr } = await serviceClient.auth.admin.deleteUser(newUserId);
            if (delAuthErr) throw delAuthErr;
          } catch (e) {
            console.error(`[bulk-provision-credentials] Rollback auth user failed for ${newUserId}:`, e);
            cleanupFailed = true;
          }
          if (cleanupFailed) {
            console.error(`[bulk-provision-credentials] CRITICAL: MANUAL CLEANUP REQUIRED FOR ${teamId}. Reason: ${reason}`);
          }
        };

        // Insert Secret
        const { error: insertErr } = await serviceClient
          .from("team_credential_secrets")
          .insert({
            team_id: teamId,
            encrypted_password: encryptedPassword,
          });

        if (insertErr) {
          await rollback(`Secret insert failed: ${insertErr.message}`);
          throw new Error(`Secret insert failed: ${insertErr.message}`);
        }
        secretInsertedByUs = true;

        // Bind auth_id
        const { error: updateErr, data: updated } = await serviceClient
          .from("shortlisted_teams")
          .update({ auth_id: newUserId })
          .eq("team_id", teamId)
          .is("auth_id", null)
          .select()
          .maybeSingle();

        if (updateErr || !updated) {
          await rollback(updateErr ? `Bind auth_id failed: ${updateErr.message}` : "Concurrency failure on bind");
          throw new Error(updateErr ? updateErr.message : "auth_id was concurrently modified");
        }

        results.PROVISIONED.push({ teamId, password: plainPassword });

      } catch (err: any) {
        console.error(`[bulk-provision-credentials] Failed for team ${teamId}:`, err);
        results.FAILED.push(teamId);
        // Continue processing remaining teams
      }
    }

    return json({ success: true, results });
  } catch (err: any) {
    console.error("[bulk-provision-credentials] Global error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
