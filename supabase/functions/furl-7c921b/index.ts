import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.20.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@0.4.3";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (Deno.env.get("IP_SALT") || "default_salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  try {
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const ipHash = await hashIp(ip);

    // 1. Safe Bounded Payload Reading (Protect against spoofed Content-Length OOM)
    const MAX_BYTES = 1024 * 50; // 50KB
    let bytesRead = 0;
    const chunks = [];
    if (req.body) {
      const reader = req.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          bytesRead += value.length;
          if (bytesRead > MAX_BYTES) {
            return new Response("Payload too large", { status: 413 });
          }
          chunks.push(value);
        }
      }
    }
    const bodyText = new TextDecoder().decode(new Uint8Array(await new Blob(chunks).arrayBuffer()));

    // 2. Redis Rate Limiting (Fail-open)
    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    
    if (upstashUrl && upstashToken) {
      try {
        const redisClient = new Redis({ url: upstashUrl, token: upstashToken });
        const ratelimit = new Ratelimit({
          redis: redisClient,
          limiter: Ratelimit.slidingWindow(30, "15 m"), // Max 30 callbacks per 15 minutes per IP
          analytics: false,
        });
        
        const { success } = await ratelimit.limit(`ratelimit:furl:${ipHash}`);
        if (!success) {
          return new Response("Rate limit exceeded", { status: 429 });
        }
      } catch (err) {
        // FAIL OPEN: Since these callbacks are non-authoritative and only create audit records, 
        // we fail open on Redis error so we do not unnecessarily interfere with legitimate Easebuzz callbacks.
        console.warn("Redis unavailable, bypassing rate limit for FURL");
      }
    }
    
    const formData = new URLSearchParams(bodyText);
    const txnid = formData.get("txnid")?.toString() || null;
    const amountStr = formData.get("amount")?.toString() || null;
    
    const payload = Object.fromEntries(formData.entries());
    let amount = null;
    
    if (amountStr) {
      amount = parseFloat(amountStr) * 100; // Convert to paise
    }

    const userAgent = req.headers.get("user-agent") || "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const processBackgroundWork = async () => {
      try {
        await supabase.from("easebuzz_audit_log").insert({
          event_type: 'FURL_CALLBACK',
          easebuzz_txnid: txnid,
          amount: amount ? Math.round(amount) : null,
          payload: payload,
          ip_address: ip,
          user_agent: userAgent
        });

        const udf1 = formData.get("udf1")?.toString(); // Used as Team ID
        if (udf1) {
          // Optionally mark the team as FAILED
          await supabase.from("shortlisted_teams")
            .update({ payment_status: "FAILED" })
            .eq("team_id", udf1);
        }
      } catch (err) {
        console.error("Background task failed:", err);
      }
    };

    // Fire and forget background processing to make the redirect lightning fast
    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(processBackgroundWork());
    } else {
      processBackgroundWork();
    }

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://specathon.in";
    const redirectUrl = new URL(`${frontendUrl}/team/payment/x1y2z3a4b5c6d7e8`);
    if (txnid) redirectUrl.searchParams.set("txnid", txnid);
    if (amountStr) redirectUrl.searchParams.set("amount", amountStr);
    redirectUrl.searchParams.set("status", "failed");

    return new Response(null, {
      status: 303,
      headers: {
        "Location": redirectUrl.toString(),
      }
    });

  } catch (err: any) {
    return new Response(`Error processing request`, { status: 500 });
  }
});
