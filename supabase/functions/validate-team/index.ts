import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, x-client-info, authorization",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing secret: SUPABASE_URL");
  if (!key) throw new Error("Missing secret: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ShortlistedTeam = {
  team_id:        string;
  team_name:      string;
  team_lead_name: string;
  team_size:      number;
  amount:         number;
  payment_status: string;
};

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // ── 1. Parse request body ─────────────────────────────────────────────────

  let teamId: string;
  try {
    const body = await req.json() as { teamId?: unknown };
    teamId = (typeof body.teamId === "string" ? body.teamId : "").trim();
  } catch {
    return json({ success: false, message: "Request body must be JSON." }, 400);
  }

  if (!teamId) {
    return json({ success: false, message: "teamId is required." }, 400);
  }

  // ── 2. Look up team ───────────────────────────────────────────────────────
  // Select only the columns needed for validation + the payment page.
  // payment_status is fetched here but is NOT returned in the success response —
  // it is used only for the already-paid guard below.

  let team: ShortlistedTeam;
  try {
    const db = createServiceClient();

    const { data, error } = await db
      .from("shortlisted_teams")
      .select("team_id, team_name, team_lead_name, team_size, amount, payment_status")
      .eq("team_id", teamId)
      .single();

    if (error) {
      // PostgREST returns code PGRST116 when .single() finds no rows.
      if (
        error.code === "PGRST116" ||
        error.message?.toLowerCase().includes("no rows")
      ) {
        return json(
          { success: false, message: "Team not found. Check your Team ID and try again." },
          404
        );
      }
      // Any other DB error — do not leak details.
      console.error("[validate-team] DB error:", error);
      return json({ success: false, message: "Failed to look up team." }, 500);
    }

    if (!data) {
      return json(
        { success: false, message: "Team not found. Check your Team ID and try again." },
        404
      );
    }

    team = data as ShortlistedTeam;
  } catch (err) {
    console.error("[validate-team] Unexpected error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }

  // ── 3. Payment status guard ───────────────────────────────────────────────
  // A PAID team must not re-enter the payment flow under any circumstances.

  if (team.payment_status === "PAID") {
    return json(
      {
        success: false,
        message: "Payment has already been completed for this team.",
      },
      409
    );
  }

  // ── 4. Return public fields only ──────────────────────────────────────────
  // payment_status is intentionally omitted from the response.

  return json({
    success: true,
    team: {
      team_id:        team.team_id,
      team_name:      team.team_name,
      team_lead_name: team.team_lead_name,
      team_size:      team.team_size,
      amount:         team.amount,
    },
  });
});
