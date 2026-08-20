import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";

// ── CORS ──────────────────────────────────────────────────────────────────────
// Public endpoint — allow any origin so the public website can call it directly.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, x-client-info, authorization",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Service-role client — bypasses RLS so the public query works even though
 *  no SELECT policy is defined on shortlisted_teams yet. No user data is
 *  returned; only the three public fields are selected. */
function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing secret: SUPABASE_URL");
  if (!key) throw new Error("Missing secret: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only GET is allowed — this is a read-only public endpoint.
  if (req.method !== "GET") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // ── Parse query params ───────────────────────────────────────────────────
  // ?q=<search>  — optional, case-insensitive partial match on team_id or
  //                team_name. Absent or empty string returns all teams.

  const url    = new URL(req.url);
  const query  = url.searchParams.get("q")?.trim() ?? "";
  const teamId = url.searchParams.get("teamId")?.trim() ?? "";

  // ── Exact Team ID lookup (public shortlist search) ────────────────────────
  // Distinguishes three states the caller cannot tell apart from a plain
  // "not found": an invalid/unregistered Team ID, a real but not-yet-
  // shortlisted registration, and a confirmed shortlisted team. Only the
  // three approved public fields are ever selected — payment_status,
  // payment_notes, paid_at, amount and contact are never queried here, so
  // they cannot leak even by accident.
  //
  // Known limitation: "registered" is checked against public.teams, which
  // only contains WEBSITE-channel registrations. Unstop-sourced teams that
  // were not shortlisted have no record in this database at all, so they
  // will be reported as "not_registered" rather than "not_shortlisted".
  if (teamId.length > 0) {
    try {
      const db = createServiceClient();

      const { data: shortlisted, error: shortlistError } = await db
        .from("shortlisted_teams")
        .select("team_id, team_name, team_lead_name")
        .eq("team_id", teamId)
        .maybeSingle();

      if (shortlistError) {
        console.error("[shortlisted-teams] DB error (shortlist lookup):", shortlistError);
        return json({ success: false, message: "Failed to look up team." }, 500);
      }

      if (shortlisted) {
        return json({ success: true, state: "shortlisted", team: shortlisted });
      }

      const { data: registered, error: teamsError } = await db
        .from("teams")
        .select("id")
        .eq("reg_code", teamId)
        .maybeSingle();

      if (teamsError) {
        console.error("[shortlisted-teams] DB error (registered lookup):", teamsError);
        return json({ success: false, message: "Failed to look up team." }, 500);
      }

      if (registered) {
        return json({ success: true, state: "not_shortlisted" });
      }

      return json({ success: true, state: "not_registered" });

    } catch (err) {
      console.error("[shortlisted-teams] Unexpected error:", err);
      return json({ success: false, message: "Internal server error." }, 500);
    }
  }

  // ── Query shortlisted_teams ───────────────────────────────────────────────
  // Select ONLY the three approved public fields.
  // Sensitive columns (id, contact, amount, payment_status, etc.) are
  // never selected — they are absent from the response at the query level,
  // not just filtered in application code.

  try {
    const db = createServiceClient();

    let builder = db
      .from("shortlisted_teams")
      .select("team_id, team_name, team_lead_name")
      .order("team_id", { ascending: true });

    // Apply search filter when a query is provided.
    // PostgREST `or` with `ilike` gives case-insensitive partial matching
    // across both team_id and team_name in a single round-trip.
    if (query.length > 0) {
      builder = builder.or(
        `team_id.ilike.%${query}%,team_name.ilike.%${query}%`
      );
    }

    const { data, error } = await builder;

    if (error) {
      console.error("[shortlisted-teams] DB error:", error);
      return json({ success: false, message: "Failed to fetch shortlisted teams." }, 500);
    }

    return json({
      success: true,
      count:   (data ?? []).length,
      teams:   data ?? [],
    });

  } catch (err) {
    console.error("[shortlisted-teams] Unexpected error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
