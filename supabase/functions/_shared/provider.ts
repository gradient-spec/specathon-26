/**
 * SPECATHON 2026 · V2 — Payment Provider Factory
 *
 * This is the ONLY place in the codebase where a concrete provider
 * is instantiated. Every Edge Function calls getProvider() and
 * works exclusively against the PaymentProvider interface.
 *
 * Active provider is controlled by the PAYMENT_PROVIDER environment
 * variable set in Supabase secrets:
 *
 *   PAYMENT_PROVIDER=dummy     →  DummyPaymentProvider   (current)
 *   PAYMENT_PROVIDER=razorpay  →  RazorpayPaymentProvider (future)
 *
 * Switching providers = one env var change in Supabase dashboard.
 * No code changes, no redeployment of any Edge Function other than
 * the functions that import this module (which get re-deployed anyway).
 */

import type { PaymentProvider }         from "./types.ts";
import { DummyPaymentProvider }         from "./providers/dummy.ts";
import { RazorpayPaymentProvider }      from "./providers/razorpay.ts";

let _instance: PaymentProvider | null = null;

export function getProvider(): PaymentProvider {
  if (_instance) return _instance;

  const name = (Deno.env.get("PAYMENT_PROVIDER") ?? "dummy").toLowerCase().trim();

  switch (name) {
    case "dummy":
      _instance = new DummyPaymentProvider();
      break;
    case "razorpay":
      _instance = new RazorpayPaymentProvider();
      break;
    default:
      console.warn(
        `[provider] Unknown PAYMENT_PROVIDER="${name}". Falling back to dummy.`
      );
      _instance = new DummyPaymentProvider();
  }

  console.log(`[provider] Active payment provider: ${_instance.name}`);
  return _instance;
}
