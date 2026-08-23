import "@supabase/functions-js/edge-runtime.d.ts";
import { loadR2Config, createR2Client, uploadFile } from "./r2.ts";
import { rollbackR2Upload }                         from "./rollback.ts";
import { generateTeamId }                           from "./teamId.ts";
import { createSupabaseClient, saveRegistration }   from "./database.ts";
import type { MemberInput, RegistrationInput }      from "./database.ts";
import { Redis } from "npm:@upstash/redis";
import { Ratelimit } from "npm:@upstash/ratelimit";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const ACCEPTED_MIMES = new Set([
  PPTX_MIME,
  "application/octet-stream",
  "",
]);

const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-turnstile-token, x-idempotency-key",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function str(fd: FormData, key: string): string {
  return (fd.get(key) as string | null)?.trim() ?? "";
}

function bool(fd: FormData, key: string): boolean {
  const v = str(fd, key).toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function validatePptx(
  file: File,
  bytes: Uint8Array,
): { message: string; status: number } | null {
  if (file.size === 0)
    return { message: "File is empty.", status: 400 };

  if (file.size > MAX_BYTES)
    return {
      message: `File too large. Maximum allowed size is ${MAX_BYTES / 1024 / 1024} MB.`,
      status: 413,
    };

  if (!file.name.toLowerCase().endsWith(".pptx"))
    return { message: "Only .pptx files are accepted.", status: 415 };

  const mime = file.type ?? "";
  if (!ACCEPTED_MIMES.has(mime))
    return {
      message: `Unexpected MIME type: ${mime}. Upload a .pptx file.`,
      status: 415,
    };

  if (
    bytes.length < 4 ||
    bytes[0] !== ZIP_MAGIC[0] ||
    bytes[1] !== ZIP_MAGIC[1] ||
    bytes[2] !== ZIP_MAGIC[2] ||
    bytes[3] !== ZIP_MAGIC[3]
  )
    return {
      message: "File does not appear to be a valid .pptx (ZIP signature not found).",
      status: 415,
    };

  return null;
}

function parseMembers(fd: FormData): MemberInput[] {
  const raw = str(fd, "members");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MemberInput[];
  } catch {
    return [];
  }
}

async function unlockIdempotency(redisClient: Redis | null, key: string) {
  if (redisClient && key) {
    await redisClient.del(`idempotency:${key}`).catch((e) => console.error("Redis DEL error", e));
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // 1. Maintenance Mode
  if (Deno.env.get("REGISTRATION_MAINTENANCE_MODE") === "true") {
    return json({ success: false, message: "Registration is temporarily disabled for maintenance." }, 503);
  }

  // 2. Read trusted IP / Headers
  const ip = req.headers.get("cf-connecting-ip") || "unknown";
  const salt = Deno.env.get("IP_HASH_SALT") || "default_salt";
  const ipData = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", ipData);
  const ipHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const turnstileToken = req.headers.get("x-turnstile-token");
  const idempotencyKey = req.headers.get("x-idempotency-key");
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);

  if (!turnstileToken) {
    return json({ success: false, message: "Missing Turnstile security token." }, 403);
  }
  
  if (!idempotencyKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return json({ success: false, message: "Missing or invalid idempotency key." }, 400);
  }

  // 3. Turnstile Verification
  const turnstileSecret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!turnstileSecret) return json({ success: false, message: "Server misconfiguration (Turnstile)." }, 500);

  const tsData = new FormData();
  tsData.append("secret", turnstileSecret);
  tsData.append("response", turnstileToken);
  tsData.append("remoteip", ip); // Original IP, for Turnstile's own risk analysis

  try {
    const tsResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: tsData,
    });
    const tsResult = await tsResponse.json();
    if (!tsResult.success) {
      console.warn(`[Security] Turnstile failed for IP hash: ${ipHash}`, tsResult);
      return json({ success: false, message: "Security check failed. Please refresh and try again." }, 403);
    }
  } catch (err) {
    console.error(`[Security] Turnstile fetch error:`, err);
    return json({ success: false, message: "Security service unavailable. Please try again later." }, 403); // Fail-closed for Turnstile
  }

  // Redis Init
  const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
  const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");
  let redisClient: Redis | null = null;
  if (upstashUrl && upstashToken) {
    try {
      redisClient = new Redis({ url: upstashUrl, token: upstashToken });
    } catch (err) {
      console.error("[Redis] Init error", err);
    }
  }

  // 4. Rate-limit check
  if (redisClient) {
    try {
      const ratelimit = new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(30, "1 h"),
        analytics: false,
      });
      const { success } = await ratelimit.limit(`ratelimit:upload_abstract:${ipHash}`);
      if (!success) {
        console.warn(`[Security] Rate limit exceeded for IP hash: ${ipHash}`);
        return json({ success: false, message: "Too many registration attempts. Please try again later." }, 429);
      }
    } catch (err) {
      console.error("[Redis] Rate limit error (failing open):", err);
    }
  }

  // 5. Idempotency Lock
  if (redisClient) {
    try {
      const lockKey = `idempotency:${idempotencyKey}`;
      const locked = await redisClient.set(lockKey, "locked", { nx: true, ex: 86400 });
      if (!locked) {
        console.warn(`[Security] Idempotency conflict for key: ${idempotencyKey}`);
        return json({ success: false, message: "This registration request is already being processed." }, 409);
      }
    } catch (err) {
      console.error("[Redis] Idempotency error (failing open):", err);
    }
  }

  // 6. Content-Length Early Rejection
  if (contentLength > MAX_BYTES) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: `Payload too large. Maximum allowed is ${MAX_BYTES / 1024 / 1024} MB.` }, 413);
  }

  // 7. Multipart Parsing
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Request body must be valid multipart/form-data." }, 400);
  }

  const entry = fd.get("file");
  if (!entry) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Missing required field: file." }, 400);
  }
  if (typeof entry === "string") {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Field 'file' must be a file, not a text value." }, 400);
  }

  const file = entry as File;

  // 8. Actual File.size validation
  if (file.size > MAX_BYTES) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: `File too large. Maximum allowed size is ${MAX_BYTES / 1024 / 1024} MB.` }, 413);
  }

  // Read bytes
  let fileBytes: Uint8Array;
  try {
    fileBytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Failed to read file content." }, 500);
  }

  // 9. MIME / Magic-byte Validation
  const fileErr = validatePptx(file, fileBytes);
  if (fileErr) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: fileErr.message }, fileErr.status);
  }

  const teamName     = str(fd, "team_name");
  const teamSizeRaw  = str(fd, "team_size");
  const domain       = str(fd, "domain");
  const projectTitle = str(fd, "project_title");
  const leaderName   = str(fd, "leader_name");
  const leaderEmail  = str(fd, "leader_email");
  const leaderPhone  = str(fd, "leader_phone");
  const college      = str(fd, "college");
  const isInternal   = bool(fd, "is_internal");
  const paymentAck   = bool(fd, "payment_ack");
  const templateConf = bool(fd, "template_confirmed");

  if (!teamName || !teamSizeRaw || !domain || !projectTitle || !leaderName || !leaderEmail || !leaderPhone || !college) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Missing required fields." }, 400);
  }
  
  if (!paymentAck || !templateConf) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Must confirm payment and template terms." }, 400);
  }

  const teamSize = parseInt(teamSizeRaw, 10);
  if (isNaN(teamSize) || teamSize < 2 || teamSize > 4) {
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "team_size must be 2, 3, or 4." }, 400);
  }

  let r2Cfg, dbClient, teamId;
  try {
    r2Cfg = loadR2Config();
    dbClient = createSupabaseClient();
    teamId = await generateTeamId(dbClient);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initialise configuration or clients.";
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: msg }, 500);
  }

  // 10. R2 Upload
  const r2Key = `specathon-2026/abstracts/${teamId}.pptx`;
  const r2Client = createR2Client(r2Cfg);

  try {
    await uploadFile(r2Client, r2Cfg.bucketName, r2Key, fileBytes, PPTX_MIME);
  } catch (err) {
    console.error("[R2] Upload failed:", err);
    await unlockIdempotency(redisClient, idempotencyKey);
    return json({ success: false, message: "Upload to Cloudflare R2 failed." }, 502);
  }

  // 11. register_team() via service_role
  const registration: RegistrationInput = {
    teamId, r2Key, originalName: file.name,
    teamName, teamSize, domain, projectTitle,
    leaderName, leaderEmail, leaderPhone, college,
    isInternal,
    leaderYear: str(fd, "leader_year") || undefined,
    leaderRoll: str(fd, "leader_roll") || undefined,
    leaderDept: str(fd, "leader_dept") || undefined,
    collegeState: str(fd, "college_state") || undefined,
    collegeCity: str(fd, "college_city") || undefined,
    members: parseMembers(fd),
    paymentAck, templateConfirmed: templateConf,
  };

  try {
    await saveRegistration(dbClient, registration);
    // Success: Keep the idempotency key locked to prevent duplicates
    console.info(`[Registration] Success: ${teamId} by IP hash ${ipHash}`);
  } catch (err) {
    try {
      await rollbackR2Upload(r2Client, r2Cfg.bucketName, r2Key, err);
    } catch (rollbackErr) {
      const rawMsg = rollbackErr instanceof Error ? rollbackErr.message : "";
      const errWithCode = rollbackErr as { code?: string };
      // Duplicate email/phone legitimate validation failure -> Unlock idempotency so they can fix it
      if (errWithCode.code === "23505" || errWithCode.code?.startsWith("23")) {
        await unlockIdempotency(redisClient, idempotencyKey);
        return json({ success: false, message: "This email or phone has already been registered." }, 409);
      }
      
      // Other database constraint error
      if (errWithCode.code?.startsWith("P0") || errWithCode.code?.startsWith("42")) {
         await unlockIdempotency(redisClient, idempotencyKey);
      }
      return json({ success: false, message: rawMsg || "Registration could not be saved. Please try again." }, 500);
    }
  }

  return json({ success: true, teamId, r2Key });
});
