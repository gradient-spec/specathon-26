import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { getProvider }  from "../_shared/provider.ts";
import { buildConfirmationEmail } from "../_shared/email-template.ts";

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

type CallbackBody = {
  orderId:   string;
  paymentId: string;
  status:    "SUCCESS" | "FAILED";
  /** Optional: raw provider signature for verifyWebhook(). */
  signature?: string;
};

type OrderCreatedEvent = {
  id:                  string;   // payment_events.id
  shortlisted_team_id: string;   // UUID — FK to shortlisted_teams
  amount:              number;
};

type ShortlistedTeam = {
  id:             string;
  payment_status: string;
  team_id:        string;
  team_name:      string;
  team_lead_name: string;
  email:          string | null;
};

// ── Email ─────────────────────────────────────────────────────────────────────

/**
 * Sends the payment confirmation email via Resend.
 * Non-fatal — payment success is never rolled back if email fails.
 * Idempotency is enforced by the caller (email is only called when
 * transitioning from non-PAID → PAID for the first time).
 */
async function sendConfirmationEmail(
  team:      ShortlistedTeam,
  paymentId: string,
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[payment-callback] RESEND_API_KEY secret is not set — email not sent.");
    return;
  }

  if (!team.email) {
    console.warn(
      `[payment-callback] No email for team ${team.team_id} — confirmation email skipped.`
    );
    return;
  }

  const { subject, html, text } = buildConfirmationEmail({
    teamName:       team.team_name,
    teamLeadName:   team.team_lead_name,
    registrationId: team.team_id,
    toEmail:        team.email,
  });

  const payload = {
    from:    "SPECATHON 2026 <gradient@stpetershyd.com>",
    to:      [team.email],
    subject,
    html,
    text,
  };

  const logCtx = {
    team_id:    team.team_id,
    team_name:  team.team_name,
    recipient:  team.email,
    payment_id: paymentId,
    timestamp:  new Date().toISOString(),
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseBody = await res.json();

    if (!res.ok) {
      console.error("[payment-callback] Email send FAILED:", {
        ...logCtx,
        success:  false,
        status:   res.status,
        response: responseBody,
      });
    } else {
      console.log("[payment-callback] Email send SUCCESS:", {
        ...logCtx,
        success:   true,
        resend_id: responseBody.id,
      });
    }
  } catch (err) {
    console.error("[payment-callback] Email send threw an exception:", {
      ...logCtx,
      success: false,
      error:   err instanceof Error ? err.message : String(err),
    });
  }
}

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

  let body: CallbackBody;
  try {
    body = await req.json() as CallbackBody;
  } catch {
    return json({ success: false, message: "Request body must be JSON." }, 400);
  }

  const orderId   = (typeof body.orderId   === "string" ? body.orderId   : "").trim();
  const paymentId = (typeof body.paymentId === "string" ? body.paymentId : "").trim();
  const status    = (typeof body.status    === "string" ? body.status    : "").trim().toUpperCase();
  const signature = typeof body.signature  === "string" ? body.signature : "";

  if (!orderId)   return json({ success: false, message: "orderId is required."   }, 400);
  if (!paymentId) return json({ success: false, message: "paymentId is required." }, 400);
  if (!["SUCCESS", "FAILED"].includes(status)) {
    return json(
      { success: false, message: 'status must be "SUCCESS" or "FAILED".' },
      400
    );
  }

  // ── 2. Verify webhook signature (provider-agnostic) ───────────────────────
  // For Dummy: verifyWebhook() always returns true — no secret exists.
  // For Razorpay: this becomes HMAC-SHA256 verification.
  // The raw body string is used for signature verification — we already
  // parsed it above, so we re-serialise for the provider to verify.

  const provider = getProvider();
  const rawBody  = JSON.stringify(body);
  const verified = provider.verifyWebhook(rawBody, signature);

  // For non-dummy providers, reject unverified webhooks immediately.
  if (!verified && provider.name !== "dummy") {
    console.warn("[payment-callback] Signature verification failed.");
    return json({ success: false, message: "Webhook signature verification failed." }, 401);
  }

  const db = createServiceClient();

  // ── 3. Locate the ORDER_CREATED event ────────────────────────────────────
  // The order ID from the callback must match an existing ORDER_CREATED event.
  // This links the callback to the correct shortlisted team.

  let orderEvent: OrderCreatedEvent;
  try {
    const { data, error } = await db
      .from("payment_events")
      .select("id, shortlisted_team_id, amount")
      .eq("razorpay_order_id", orderId)
      .eq("event_type", "ORDER_CREATED")
      .single();

    if (error || !data) {
      return json(
        { success: false, message: "No matching order found for the provided orderId." },
        404
      );
    }

    orderEvent = data as OrderCreatedEvent;
  } catch (err) {
    console.error("[payment-callback] Order lookup error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }

  // ── 4. Load current shortlisted_teams status ──────────────────────────────

  let team: ShortlistedTeam;
  try {
    const { data, error } = await db
      .from("shortlisted_teams")
      .select("id, payment_status, team_id, team_name, team_lead_name, email")
      .eq("id", orderEvent.shortlisted_team_id)
      .single();

    if (error || !data) {
      console.error("[payment-callback] Team lookup error:", error);
      return json({ success: false, message: "Internal server error." }, 500);
    }

    team = data as ShortlistedTeam;
  } catch (err) {
    console.error("[payment-callback] Unexpected team lookup error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }

  // ── 5. Duplicate / idempotency guard ──────────────────────────────────────
  // If the team is already PAID, a duplicate SUCCESS callback must be silently
  // accepted. Do not create a second PAYMENT_SUCCESS event or update the row.
  // Return success so the provider does not retry.

  if (team.payment_status === "PAID") {
    console.log(
      `[payment-callback] Idempotency: team ${team.id} already PAID. ` +
      `Ignoring duplicate callback for order ${orderId}.`
    );
    return json({ success: true });
  }

  // ── 6. Build the payment_events payload ───────────────────────────────────

  const eventPayload = {
    provider:    provider.name,
    order_id:    orderId,
    payment_id:  paymentId,
    status,
    verified,
    raw:         body,
  };

  // ── 7a. Handle SUCCESS ────────────────────────────────────────────────────

  if (status === "SUCCESS") {
    try {
      // Insert PAYMENT_SUCCESS event
      const { error: eventError } = await db
        .from("payment_events")
        .insert({
          shortlisted_team_id: orderEvent.shortlisted_team_id,
          razorpay_order_id:   orderId,
          razorpay_payment_id: paymentId,
          event_type:          "PAYMENT_SUCCESS",
          amount:              orderEvent.amount,
          payload:             eventPayload,
          signature_verified:  verified,
        });

      if (eventError) {
        console.error("[payment-callback] Failed to insert PAYMENT_SUCCESS event:", eventError);
        return json({ success: false, message: "Failed to record payment event." }, 500);
      }

      // Update shortlisted_teams: mark as PAID with timestamp
      const { error: updateError } = await db
        .from("shortlisted_teams")
        .update({ payment_status: "PAID", paid_at: new Date().toISOString() })
        .eq("id", orderEvent.shortlisted_team_id);

      if (updateError) {
        // Event was written but the status update failed.
        // Log it — a background job or admin can reconcile.
        console.error(
          "[payment-callback] PAYMENT_SUCCESS event written but shortlisted_teams update failed:",
          updateError
        );
        return json({ success: false, message: "Payment recorded but status update failed. Please contact support." }, 500);
      }

      // ── Send confirmation email (non-fatal) ────────────────────────────
      // Called only here — after a confirmed PAID transition.
      // The idempotency guard above (team.payment_status === "PAID") ensures
      // this code path runs exactly once per team.
      await sendConfirmationEmail(team, paymentId);

      return json({ success: true });

    } catch (err) {
      console.error("[payment-callback] Unexpected SUCCESS handling error:", err);
      return json({ success: false, message: "Internal server error." }, 500);
    }
  }

  // ── 7b. Handle FAILED ─────────────────────────────────────────────────────
  // Insert PAYMENT_FAILED event only.
  // shortlisted_teams is NOT modified — FAILED teams may retry.

  try {
    const { error: eventError } = await db
      .from("payment_events")
      .insert({
        shortlisted_team_id: orderEvent.shortlisted_team_id,
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
        event_type:          "PAYMENT_FAILED",
        amount:              orderEvent.amount,
        payload:             eventPayload,
        signature_verified:  verified,
      });

    if (eventError) {
      console.error("[payment-callback] Failed to insert PAYMENT_FAILED event:", eventError);
      return json({ success: false, message: "Failed to record payment event." }, 500);
    }

    return json({ success: true });

  } catch (err) {
    console.error("[payment-callback] Unexpected FAILED handling error:", err);
    return json({ success: false, message: "Internal server error." }, 500);
  }
});
