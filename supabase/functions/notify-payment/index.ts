import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.20.0";
import { Ratelimit } from "https://esm.sh/@upstash/ratelimit@0.4.3";

serve(async (req) => {
  // 1. CORS headers
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    // User client to verify JWT
    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    
    const { data: { user }, error: authError } = await supabaseAuthClient.auth.getUser();
    if (authError || !user || !user.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Extract Team ID securely from email
    if (!user.email.endsWith("@teams.specathon.in")) {
      return new Response(JSON.stringify({ error: 'Not a team account' }), { status: 403, headers: corsHeaders });
    }
    const teamId = user.email.split("@")[0].toUpperCase();

    // 2. No Request Body needed since Easebuzz is static

    // 3. Upstash Redis Rate Limiting (1 notification per 12 hours per team)
    const redisUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const redisToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
    
    if (redisUrl && redisToken) {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const ratelimit = new Ratelimit({
        redis: redis,
        limiter: Ratelimit.slidingWindow(1, "12 h"),
        analytics: false,
        ephemeralCache: new Map(),
      });
      
      const { success } = await ratelimit.limit(`notify_payment_${teamId}`);
      if (!success) {
        return new Response(JSON.stringify({ message: 'Notification already sent recently.' }), { status: 429, headers: corsHeaders });
      }
    }

    // 4. Fetch Exact Team Details
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: teamData } = await supabaseAdmin
      .from("shortlisted_teams")
      .select("team_name, amount, payment_status")
      .eq("team_id", teamId)
      .single();

    const teamName = teamData?.team_name || "Unknown Team";
    const dbAmount = teamData?.amount !== null && teamData?.amount !== undefined ? teamData.amount : "Unknown";

    // 5. Send Telegram Message
    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
    
    if (telegramBotToken && telegramChatId) {
      const message = `🎉 *New Payment Received!* 🎉\n\n*Team ID:* \`${teamId}\`\n*Team Name:* ${teamName}\n*Amount:* ₹${dbAmount}\n\n*(Please verify in Easebuzz before marking as PAID)*`;
      
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: 'Markdown'
        })
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Notification sent.' }), { status: 200, headers: corsHeaders });

  } catch (err: any) {
    console.error("Error in notify-payment", err);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: corsHeaders });
  }
});
