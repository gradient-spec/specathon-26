/**
 * SPECATHON 2026 · V2 — Dummy Payment Provider
 *
 * Simulates a real payment gateway with no external network calls.
 * Generates realistic identifiers that match the naming convention
 * Razorpay uses (order_*, pay_*) so the rest of the app never needs
 * to branch on which provider is active.
 *
 * Replace this with RazorpayPaymentProvider when credentials arrive.
 * Nothing outside _shared/ needs to change.
 */

import type { CreateOrderParams, OrderResult, PaymentProvider } from "../types.ts";

export class DummyPaymentProvider implements PaymentProvider {
  readonly name = "dummy";

  async createOrder(params: CreateOrderParams): Promise<OrderResult> {
    // Generate a realistic order ID:
    //   "dummy_order_" + 8 random hex chars
    // Matches the visual shape of a Razorpay order ID ("order_xxx...").
    const orderId = `dummy_order_${randomHex(8)}`;

    // No network call — resolve immediately.
    return await Promise.resolve({
      orderId,
      amount:       params.amount,
      currency:     "INR",
      providerName: this.name,
    });
  }

  verifyWebhook(_payload: string, _signature: string): boolean {
    // Dummy provider has no secret — all webhooks are considered valid.
    // When Razorpay is wired in, this becomes HMAC-SHA256 verification.
    return true;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
