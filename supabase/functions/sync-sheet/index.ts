/**
 * SPECATHON 2026 · V2 — sync-sheet Edge Function
 *
 * POST /functions/v1/sync-sheet
 *
 * Body:
 *   { "teamIds": ["SPEC2026-0001", "SPEC2026-0002", …] }
 *
 * What it does:
 *   1. Fetches the specified shortlisted_teams rows from Supabase.
 *   2. For WEBSITE teams, joins the V1 `teams` table to retrieve the
 *      leader email (shortlisted_teams has no email column).
 *   3. Upserts all rows into the Automation Google Sheet via the
 *      Sheets API v4 (see _shared/sheets.ts).
 *
 * Called by:
 *   - import_shortlisted_teams() flow (after CSV import)
 *   - payment-callback (after PAID update)
 *
 * Error contract:
 *   - Always returns { success: true|false }.
 *   - NEVER causes the caller to fail — both CSV import and payment
 *     must succeed even if the sheet sync fails.
 *   - Errors are logged with full detail for investigation.
 *
 * Auth:
 *   - verify_jwt = true (admin-only, internal caller)
 *   - Uses service-role Supabase client internally.
 */

import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { upsertSheetRows, type SheetRow } from "../_shared/sheets.ts";

// ── CORS ──────────────────────────────────────────────────────────────────────

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

// ── Supabase ──────────────────────────────────────────────────────────────────

function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing secret: SUPABASE_URL");
  if (!key) throw new Error("Missing secret: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Types matching Supabase rows ──────────────────────────────────────────────

type ShortlistedTeamDb = {
  team_id:             string;
  registration_source: string;
  team_name:           string;
  team_lead_name:      string;
  contact:             string;
  team_size:           number;
  amount:              number;
  payment_status:      string;
  paid_at:             string | null;
  created_at:          string;
};

type V1TeamDb = {
  reg_code: string | null;
  email:    string | null;
};

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // ── 1. Parse request ──────────────────────────────────────────────────────

  let teamIds: string[];
  try {
    const body = await req.json() as { teamIds?: unknown };
    if (!Array.isArray(body.teamIds) || body.teamIds.length === 0) {
      return json({ success: false, message: "teamIds must be a non-empty array." }, 400);
    }
    teamIds = (body.teamIds as unknown[])
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      .map((id) => id.trim());

    if (teamIds.length === 0) {
      return json({ success: false, message: "No valid teamIds provided." }, 400);
    }
  } catch {
    return json({ success: false, message: "Request body must be JSON." }, 400);
  }

  // ── 2. Fetch shortlisted_teams rows ───────────────────────────────────────

  const db = createServiceClient();

  let shortlistedRows: ShortlistedTeamDb[];
  try {
    const { data, error } = await db
      .from("shortlisted_teams")
      .select(
        "team_id, registration_source, team_name, team_lead_name, " +
        "contact, team_size, amount, payment_status, paid_at, created_at"
      )
      .in("team_id", teamIds);

    if (error) throw error;
    shortlistedRows = (data ?? []) as ShortlistedTeamDb[];
  } catch (err) {
    console.error("[sync-sheet] Failed to fetch shortlisted_teams:", err);
    return json({ success: false, message: "Database fetch failed." }, 500);
  }

  if (shortlistedRows.length === 0) {
    console.warn("[sync-sheet] No matching shortlisted_teams found for:", teamIds);
    return json({ success: true, synced: 0 });
  }

  // ── 3. Fetch emails for WEBSITE teams from V1 `teams` table ──────────────
  // shortlisted_teams has no email column.
  // WEBSITE team_ids match reg_code in the V1 teams table.
  // UNSTOP team_ids have no matching V1 row — we fall back to contact field.

  const websiteIds = shortlistedRows
    .filter((r) => r.registration_source === "WEBSITE")
    .map((r) => r.team_id);

  const emailByTeamId = new Map<string, string>();

  if (websiteIds.length > 0) {
    try {
      const { data: v1Data, error: v1Error } = await db
        .from("teams")
        .select("reg_code, email")
        .in("reg_code", websiteIds);

      if (v1Error) {
        // Non-fatal — log and continue with empty emails
        console.warn("[sync-sheet] Failed to fetch V1 team emails:", v1Error);
      } else {
        for (const row of (v1Data ?? []) as V1TeamDb[]) {
          if (row.reg_code && row.email) {
            emailByTeamId.set(row.reg_code, row.email);
          }
        }
      }
    } catch (err) {
      // Non-fatal
      console.warn("[sync-sheet] Unexpected error fetching V1 emails:", err);
    }
  }

  // ── 4. Map to SheetRow ────────────────────────────────────────────────────
  // Email resolution strategy:
  //   WEBSITE → email from V1 teams table (fallback: contact)
  //   UNSTOP  → contact field (organiser should put email here)

  const sheetRows: SheetRow[] = shortlistedRows.map((r) => {
    const email =
      r.registration_source === "WEBSITE"
        ? (emailByTeamId.get(r.team_id) ?? r.contact)
        : r.contact;

    return {
      team_id:             r.team_id,
      registration_source: r.registration_source,
      team_name:           r.team_name,
      team_lead_name:      r.team_lead_name,
      email,
      contact:             r.contact,
      team_size:           r.team_size,
      amount:              r.amount,
      payment_status:      r.payment_status,
      paid_at:             r.paid_at ?? "",
      created_at:          r.created_at,
    };
  });

  // ── 5. Upsert into Google Sheet ───────────────────────────────────────────

  try {
    await upsertSheetRows(sheetRows);
    console.log(`[sync-sheet] Synced ${sheetRows.length} row(s) to Automation Sheet.`);
    return json({ success: true, synced: sheetRows.length });
  } catch (err) {
    console.error("[sync-sheet] Google Sheets upsert failed:", err);
    // Return 200 with success:false so the caller knows but doesn't retry
    return json(
      { success: false, message: "Google Sheets sync failed. Data is safe in Supabase." },
      200
    );
  }
});
