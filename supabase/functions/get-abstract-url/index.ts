import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient }                  from "npm:@supabase/supabase-js@^2";
import { S3Client, GetObjectCommand }     from "npm:@aws-sdk/client-s3";
import { getSignedUrl }                  from "npm:@aws-sdk/s3-request-presigner";

// ── Constants ────────────────────────────────────────────────────────────────

/** Signed URL lifetime — 10 minutes. */
const SIGNED_URL_TTL_SECONDS = 600;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Extract the Bearer token from the Authorization header. */
function extractBearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

// ── R2 client ────────────────────────────────────────────────────────────────

function createR2Client(): S3Client {
  const accessKeyId     = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  const endpoint        = Deno.env.get("R2_ENDPOINT");

  const missing = (
    [
      ["R2_ACCESS_KEY_ID",     accessKeyId],
      ["R2_SECRET_ACCESS_KEY", secretAccessKey],
      ["R2_ENDPOINT",          endpoint],
    ] as [string, string | undefined][]
  ).filter(([, v]) => !v).map(([k]) => k);

  if (missing.length > 0) throw new Error(`Missing secrets: ${missing.join(", ")}`);

  return new S3Client({
    region:      "auto",
    endpoint:    endpoint!,
    credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
  });
}

// ── Supabase clients ─────────────────────────────────────────────────────────

/**
 * Service-role client — bypasses RLS.
 * Used only for reading the team record after authorization is confirmed.
 */
function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing secret: SUPABASE_URL");
  if (!key) throw new Error("Missing secret: SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * User-context client — calls Supabase using the caller's JWT.
 * Used exclusively to call is_admin() so the result reflects the actual
 * caller's admin status, not the service account's.
 */
function createUserClient(accessToken: string) {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url)     throw new Error("Missing secret: SUPABASE_URL");
  if (!anonKey) throw new Error("Missing secret: SUPABASE_ANON_KEY");
  return createClient(url, anonKey, {
    auth:    { persistSession: false, autoRefreshToken: false },
    global:  { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // ── 1. Extract caller JWT ────────────────────────────────────────────────
  // verify_jwt = true in config.toml means Supabase has already validated the
  // JWT signature before this handler runs. We still need to check that the
  // validated caller is an admin — any authenticated user has a valid JWT, but
  // only allowlisted admins should receive signed abstract URLs.
  const accessToken = extractBearer(req);
  if (!accessToken) {
    return json({ success: false, message: "Authorization header is required." }, 401);
  }

  // ── 2. Admin authorization check ─────────────────────────────────────────
  // Call is_admin() with the caller's own JWT so that auth.jwt() inside the
  // Postgres function resolves to the real caller's email, not the service role.
  try {
    const userClient = createUserClient(accessToken);
    const { data: isAdmin, error } = await userClient.rpc("is_admin");
    if (error) throw new Error(error.message);
    if (!isAdmin) {
      return json({ success: false, message: "Forbidden: admin access required." }, 403);
    }
  } catch (err) {
    console.error("[get-abstract-url] admin check failed:", err);
    return json({ success: false, message: "Authorization check failed." }, 500);
  }

  // ── 3. Parse request body ────────────────────────────────────────────────
  let teamId: string;
  try {
    const body = await req.json() as { teamId?: string };
    teamId = (body.teamId ?? "").trim();
  } catch {
    return json({ success: false, message: "Request body must be JSON with a teamId field." }, 400);
  }

  if (!teamId) {
    return json({ success: false, message: "teamId is required." }, 400);
  }

  // ── 4. Look up abstract_url in Supabase ──────────────────────────────────
  // Use service-role client here — we already confirmed the caller is an admin.
  let abstractKey: string;
  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("teams")
      .select("abstract_url")
      .eq("reg_code", teamId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Team not found.");

    const url = (data as { abstract_url: string | null }).abstract_url;
    if (!url) throw new Error("No abstract has been uploaded for this team.");

    abstractKey = url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Database lookup failed.";
    if (msg.includes("not found") || msg.includes("No abstract")) {
      return json({ success: false, message: msg }, 404);
    }
    console.error("[get-abstract-url] DB error:", err);
    return json({ success: false, message: "Failed to retrieve team record." }, 500);
  }

  // ── 5. Generate presigned R2 download URL ────────────────────────────────
  const bucketName = Deno.env.get("R2_BUCKET_NAME");
  if (!bucketName) {
    return json({ success: false, message: "Missing secret: R2_BUCKET_NAME" }, 500);
  }

  let signedUrl: string;
  try {
    const r2 = createR2Client();
    signedUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: bucketName, Key: abstractKey }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  } catch (err) {
    console.error("[get-abstract-url] R2 presign error:", err);
    return json({ success: false, message: "Failed to generate download URL." }, 502);
  }

  // ── 6. Return signed URL — credentials never leave this function ──────────
  return json({ success: true, signedUrl });
});
