/**
 * SPECATHON 2026 · V2 — Razorpay Payment Provider (STUB)
 *
 * This file is intentionally left as a stub until Razorpay credentials
 * are provided by the college.
 *
 * When credentials are available:
 *   1. Fill in createOrder() — call POST https://api.razorpay.com/v1/orders
 *      with Basic Auth (RAZORPAY_KEY_ID : RAZORPAY_KEY_SECRET).
 *   2. Fill in verifyWebhook() — HMAC-SHA256(payload, RAZORPAY_WEBHOOK_SECRET).
 *   3. Set PAYMENT_PROVIDER=razorpay in Supabase secrets.
 *   4. Deploy functions.
 *
 * Nothing else in the codebase changes.
 *
 * Required Supabase secrets when active:
 *   RAZORPAY_KEY_ID
 *   RAZORPAY_KEY_SECRET
 *   RAZORPAY_WEBHOOK_SECRET
 */

import type { CreateOrderParams, OrderResult, PaymentProvider } from "../types.ts";

export class RazorpayPaymentProvider implements PaymentProvider {
  readonly name = "razorpay";

  async createOrder(_params: CreateOrderParams): Promise<OrderResult> {
    // TODO: implement when credentials are available.
    // const keyId     = Deno.env.get("RAZORPAY_KEY_ID")!;
    // const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    // const auth      = btoa(`${keyId}:${keySecret}`);
    // const res = await fetch("https://api.razorpay.com/v1/orders", {
    //   method:  "POST",
    //   headers: { "Content-Type": "application/json", "Authorization": `Basic ${auth}` },
    //   body:    JSON.stringify({ amount: params.amount * 100, currency: "INR", receipt: params.teamId }),
    // });
    // const data = await res.json();
    // return { orderId: data.id, amount: params.amount, currency: "INR", providerName: this.name };
    throw new Error("RazorpayPaymentProvider: not yet implemented.");
  }

  verifyWebhook(_payload: string, _signature: string): boolean {
    // TODO: implement when credentials are available.
    // const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!;
    // const encoder = new TextEncoder();
    // const key  = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    // const sig  = await crypto.subtle.sign("HMAC", key, encoder.encode(_payload));
    // const hex  = Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2,"0")).join("");
    // return hex === _signature;
    throw new Error("RazorpayPaymentProvider: not yet implemented.");
  }
}
