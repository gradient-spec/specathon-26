/**
 * SPECATHON 2026 · V2 — Payment Provider Interface
 *
 * The entire payment flow depends ONLY on these types.
 * No Edge Function, frontend page, or database write imports anything
 * from a concrete provider — only from this file.
 *
 * Switching providers (Dummy → Razorpay) requires:
 *   1. Write supabase/functions/_shared/providers/razorpay.ts
 *   2. Change one line in supabase/functions/_shared/provider.ts
 *   3. Set PAYMENT_PROVIDER=razorpay in Supabase secrets
 *
 * Nothing else changes.
 */

// ── Request / response types ───────────────────────────────────────────────

export type CreateOrderParams = {
  /** Human-readable team identifier, e.g. "SPEC2026-0042". Used as receipt. */
  teamId:  string;
  /** Payment amount in INR (integer, e.g. 1600 = ₹1600). */
  amount:  number;
};

export type OrderResult = {
  /** Provider order identifier. Razorpay: "order_xxx". Dummy: "dummy_order_xxx". */
  orderId:      string;
  /** Amount in INR — echoed back for the frontend to display. */
  amount:       number;
  /** Always "INR". */
  currency:     string;
  /** Stable provider name. Written to audit log. "dummy" | "razorpay". */
  providerName: string;
};

export type VerifyWebhookResult = {
  verified: boolean;
};

// ── Provider interface ─────────────────────────────────────────────────────

export interface PaymentProvider {
  /** Stable identifier for this provider. Written to payment_events.payload. */
  readonly name: string;

  /**
   * Creates a payment order with the provider.
   * For Dummy: generates realistic identifiers locally, no network call.
   * For Razorpay: calls POST https://api.razorpay.com/v1/orders.
   */
  createOrder(params: CreateOrderParams): Promise<OrderResult>;

  /**
   * Verifies the webhook signature sent by the provider.
   * For Dummy: always returns true (no secret to verify against).
   * For Razorpay: HMAC-SHA256 verification using RAZORPAY_WEBHOOK_SECRET.
   */
  verifyWebhook(payload: string, signature: string): boolean;
}
