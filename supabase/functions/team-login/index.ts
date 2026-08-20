import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.20.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@0.4.3";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.200.0/encoding/hex.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hashString(str: string): Promise<string> {
  const data = new TextEncoder().encode(str + (Deno.env.get("IP_SALT") || "default_salt"));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return encodeHex(hash);
}


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { teamId, password, turnstileToken } = await req.json();

    if (!teamId || !password || !turnstileToken) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedTeamId = String(teamId).trim().toLowerCase();
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const ipHash = await hashString(ip);
    const teamHash = await hashString(teamId.trim().toLowerCase());

    // 1. Turnstile Verification
    const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
    if (!turnstileSecret) {
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), { status: 500, headers: corsHeaders });
    }

    const tsData = new FormData();
    tsData.append("secret", turnstileSecret);
    tsData.append("response", turnstileToken);
    tsData.append("remoteip", ip);

    try {
      const tsResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        body: tsData,
      });
      const tsResult = await tsResponse.json();
      if (!tsResult.success) {
        return new Response(JSON.stringify({ error: "Security check failed. Please refresh." }), { status: 403, headers: corsHeaders });
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: "Security service unavailable. Please try again." }), { status: 403, headers: corsHeaders });
    }

    // 2. Redis Rate Limiting (Fail-closed)
    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    
    if (!upstashUrl || !upstashToken) {
      return new Response(JSON.stringify({ error: "Server misconfiguration (Rate Limit)" }), { status: 500, headers: corsHeaders });
    }

    let redisClient: Redis;
    try {
      redisClient = new Redis({ url: upstashUrl, token: upstashToken });
      
      const ipRatelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(5, "15 m"), 
        analytics: false,
      });

      const teamRatelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(5, "15 m"), 
        analytics: false,
      });
      
      const [ipLimitRes, teamLimitRes] = await Promise.all([
        ipRatelimit.limit(`ratelimit:login:ip:${ipHash}`),
        teamRatelimit.limit(`ratelimit:login:team:${teamHash}`)
      ]);

      if (!ipLimitRes.success || !teamLimitRes.success) {
        return new Response(JSON.stringify({ error: "Too many login attempts. Please try again later." }), { status: 429, headers: corsHeaders });
      }
    } catch (err) {
      // Fail closed for security
      return new Response(JSON.stringify({ error: "Rate limiting service unavailable." }), { status: 503, headers: corsHeaders });
    }

    // 3. Supabase Auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const email = `${normalizedTeamId}@teams.specathon.in`;
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401, headers: corsHeaders });
    }

    // Return the session tokens
    return new Response(JSON.stringify({ session: data.session }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
