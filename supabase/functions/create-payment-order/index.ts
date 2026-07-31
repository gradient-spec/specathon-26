import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { getProvider }  from "../_shared/provider.ts";

// ── CORS ──────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, apikey, x-client-info",
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
  id:             string;   // UUID — used as FK in payment_events
  team_id:        string;   // Human-readable "SPEC2026-xxxx"
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

  // ── 1. Parse request ──────────────────────────────────────────────────────

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

  const db = createServiceClient();

  let team: ShortlistedTeam;
  try {
    const { data, error } = await db
      .from("shortlisted_teams")
      .select("id, team_id, amount, payment_status")
      .eq("team_id", teamId)
      .single();

    if (error) {
      if (
        error.code === "PGRST116" ||
        error.message?.toLowerCase().includes("no rows")
      ) {
        return json(
          { success: false, message: "Team not found. Check your Team ID and try again." },
          404
        );
      }
      console.error("[create-payment-order] DB lookup error:", error);
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
    console.error("[create-payment-order] Unexpected lookup error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }

  // ── 3. Payment status guard ───────────────────────────────────────────────

  if (team.payment_status === "PAID") {
    return json(
      { success: false, message: "Payment has already been completed for this team." },
      409
    );
  }

  // ── 4. Create order via provider ──────────────────────────────────────────
  // The function does not know or care which provider is active.
  // getProvider() returns DummyPaymentProvider now, RazorpayPaymentProvider later.

  let orderId: string;
  let providerName: string;
  try {
    const provider = getProvider();
    const result   = await provider.createOrder({
      teamId: team.team_id,
      amount: team.amount,
    });
    orderId      = result.orderId;
    providerName = result.providerName;
  } catch (err) {
    console.error("[create-payment-order] Provider error:", err);
    return json({ success: false, message: "Failed to create payment order." }, 500);
  }

  // ── 5. Write ORDER_CREATED event ──────────────────────────────────────────
  // shortlisted_teams is NOT updated here — only a payment_events row is inserted.
  // The webhook handler (future feature) will update shortlisted_teams.

  try {
    const { error: insertError } = await db
      .from("payment_events")
      .insert({
        shortlisted_team_id: team.id,           // UUID FK
        razorpay_order_id:   orderId,            // provider-agnostic despite the column name
        razorpay_payment_id: null,               // not yet known at order creation
        event_type:          "ORDER_CREATED",
        amount:              team.amount,
        payload:             {
          provider:   providerName,
          order_id:   orderId,
          team_id:    team.team_id,
          amount:     team.amount,
          currency:   "INR",
        },
        signature_verified:  null,               // not applicable for ORDER_CREATED
      });

    if (insertError) {
      // The order was created at the provider but the audit write failed.
      // Log it — do not fail the response because the order is real and the
      // frontend still needs it. The event can be reconstructed from provider logs.
      console.error("[create-payment-order] Failed to write payment_event:", insertError);
    }
  } catch (err) {
    console.error("[create-payment-order] Unexpected insert error:", err);
    // Same reasoning — do not fail the response.
  }

  // ── 6. Return order to frontend ───────────────────────────────────────────

  return json({
    success:  true,
    provider: providerName,
    order: {
      id:       orderId,
      amount:   team.amount,
      currency: "INR",
    },
  });
});
