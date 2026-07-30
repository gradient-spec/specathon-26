import "@supabase/functions-js/edge-runtime.d.ts";
import { loadR2Config, createR2Client, uploadFile } from "./r2.ts";
import { rollbackR2Upload }                         from "./rollback.ts";
import { generateTeamId }                           from "./teamId.ts";
import { createSupabaseClient, saveRegistration }   from "./database.ts";
import type { MemberInput, RegistrationInput }      from "./database.ts";

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
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
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

// ── File validation (unchanged from Milestone 3) ─────────────────────────────

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

// ── Parse members array from form data ───────────────────────────────────────
//
// The frontend sends members as a JSON string in a field named "members".
// e.g.  members=[{"name":"Alice","email":"alice@x.com","phone":"9876543210"}]

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

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  // ── 1. Parse multipart/form-data ─────────────────────────────────────────

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json({ success: false, message: "Request body must be multipart/form-data." }, 400);
  }

  // ── 2. Extract file ───────────────────────────────────────────────────────

  const entry = fd.get("file");
  if (!entry) return json({ success: false, message: "Missing required field: file." }, 400);
  if (typeof entry === "string")
    return json({ success: false, message: "Field 'file' must be a file, not a text value." }, 400);

  const file = entry as File;

  // ── 3. Read bytes ─────────────────────────────────────────────────────────

  let fileBytes: Uint8Array;
  try {
    fileBytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return json({ success: false, message: "Failed to read file content." }, 500);
  }

  // ── 4. Validate file (extension + MIME + ZIP magic) ───────────────────────

  const fileErr = validatePptx(file, fileBytes);
  if (fileErr) return json({ success: false, message: fileErr.message }, fileErr.status);

  // ── 5. Validate required text fields ─────────────────────────────────────

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

  if (!teamName)      return json({ success: false, message: "team_name is required." }, 400);
  if (!teamSizeRaw)   return json({ success: false, message: "team_size is required." }, 400);
  if (!domain)        return json({ success: false, message: "domain is required." }, 400);
  if (!projectTitle)  return json({ success: false, message: "project_title is required." }, 400);
  if (!leaderName)    return json({ success: false, message: "leader_name is required." }, 400);
  if (!leaderEmail)   return json({ success: false, message: "leader_email is required." }, 400);
  if (!leaderPhone)   return json({ success: false, message: "leader_phone is required." }, 400);
  if (!college)       return json({ success: false, message: "college is required." }, 400);
  if (!paymentAck)    return json({ success: false, message: "payment_ack must be true." }, 400);
  if (!templateConf)  return json({ success: false, message: "template_confirmed must be true." }, 400);

  const teamSize = parseInt(teamSizeRaw, 10);
  if (isNaN(teamSize) || teamSize < 2 || teamSize > 4)
    return json({ success: false, message: "team_size must be 2, 3, or 4." }, 400);

  // ── 6. Load R2 config and Supabase client ─────────────────────────────────

  let r2Cfg;
  try {
    r2Cfg = loadR2Config();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load R2 configuration.";
    return json({ success: false, message: msg }, 500);
  }

  let dbClient;
  try {
    dbClient = createSupabaseClient();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to initialise database client.";
    return json({ success: false, message: msg }, 500);
  }

  // ── 7. Generate concurrency-safe Team ID ─────────────────────────────────

  let teamId: string;
  try {
    teamId = await generateTeamId(dbClient);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate Team ID.";
    return json({ success: false, message: msg }, 500);
  }

  // ── 8. Upload PPTX to R2 ─────────────────────────────────────────────────
  // Final key: specathon-2026/abstracts/SPEC2026-NNNN.pptx

  const r2Key   = `specathon-2026/abstracts/${teamId}.pptx`;
  const r2Client = createR2Client(r2Cfg);

  try {
    await uploadFile(r2Client, r2Cfg.bucketName, r2Key, fileBytes, PPTX_MIME);
  } catch (err) {
    console.error("[upload-abstract] R2 upload failed:", err);
    return json({ success: false, message: "Upload to Cloudflare R2 failed." }, 502);
  }

  // ── 9. Save registration to Supabase ─────────────────────────────────────
  // If this fails we roll back the R2 upload to prevent orphaned files.

  const registration: RegistrationInput = {
    teamId,
    r2Key,
    originalName:      file.name,
    teamName,
    teamSize,
    domain,
    projectTitle,
    leaderName,
    leaderEmail,
    leaderPhone,
    college,
    isInternal,
    leaderYear:        str(fd, "leader_year")  || undefined,
    leaderRoll:        str(fd, "leader_roll")  || undefined,
    leaderDept:        str(fd, "leader_dept")  || undefined,
    collegeState:      str(fd, "college_state") || undefined,
    collegeCity:       str(fd, "college_city")  || undefined,
    members:           parseMembers(fd),
    paymentAck,
    templateConfirmed: templateConf,
  };

  try {
    await saveRegistration(dbClient, registration);
  } catch (err) {
    // Database insert failed — roll back the R2 upload.
    // rollbackR2Upload always re-throws `err` after attempting the delete.
    try {
      await rollbackR2Upload(r2Client, r2Cfg.bucketName, r2Key, err);
    } catch (rollbackErr) {
      // rollbackErr IS err (re-thrown by rollbackR2Upload)
      const rawMsg = rollbackErr instanceof Error ? rollbackErr.message : "";
      // Map known Postgres error codes to user-friendly messages
      const errWithCode = rollbackErr as { code?: string };
      if (errWithCode.code === "23505") {
        return json({ success: false, message: "This email has already been registered." }, 409);
      }
      return json(
        { success: false, message: rawMsg || "Registration could not be saved. Please try again." },
        500,
      );
    }
  }

  // ── 10. Return success ────────────────────────────────────────────────────

  return json({
    success: true,
    teamId,
    r2Key,
  });
});
