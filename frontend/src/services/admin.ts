import { supabase } from "./supabase";
import type { Status } from "../utils/constants";

export type TeamRow = {
  id: string;
  reg_code: string | null;
  created_at:          string;
  auth_id:             string | null;
  team_name: string;
  team_size: number;
  domain: string;
  college: string;
  is_internal: boolean;
  leader_name: string;
  phone: string;
  email: string | null;
  leader_year: string | null;
  leader_roll: string | null;
  leader_department: string | null;
  college_state: string | null;
  college_city: string | null;
  project_title: string | null;
  abstract_url: string | null;
  payment_ack: boolean;
  status: Status;
  notes: string | null;
  github: string | null;
  linkedin: string | null;
};

export type MemberRow = {
  id: string;
  team_id: string;
  name: string;
  phone: string | null;
  year: string | null;
  roll_number: string | null;
  department: string | null;
  email: string | null;
  role: string | null;
  created_at:          string;
  auth_id:             string | null;
};

export type FullTeam = TeamRow & { members: MemberRow[] };

function client() {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}

export async function listTeams(): Promise<TeamRow[]> {
  // Pagination loop to handle 1,000+ teams (PostgREST's db-max-rows default)
  const pageSize = 1000;
  let offset = 0;
  let allTeams: TeamRow[] = [];
  
  while (true) {
    const { data, error } = await client()
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    const page = (data ?? []) as TeamRow[];
    allTeams.push(...page);
    
    // Stop when page has fewer than pageSize rows (indicates last page)
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  
  return allTeams;
}

/**
 * Retrieve ALL members without team ID filtering.
 * Replaces listMembersFor(allTeamIds) for dashboard load path to avoid URL-length limit.
 * Uses pagination to handle 1,000+ members.
 */
export async function listAllMembers(): Promise<MemberRow[]> {
  // Pagination loop to handle 1,000+ members (PostgREST's db-max-rows default)
  const pageSize = 1000;
  let offset = 0;
  let allMembers: MemberRow[] = [];
  
  while (true) {
    const { data, error } = await client()
      .from("team_members")
      .select("*")
      .order("created_at", { ascending: true })
      .range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    const page = (data ?? []) as MemberRow[];
    allMembers.push(...page);
    
    // Stop when page has fewer than pageSize rows (indicates last page)
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  
  return allMembers;
}

export async function listMembersFor(teamIds: string[]): Promise<MemberRow[]> {
  // Short-circuit for empty array (preserve existing behavior)
  if (teamIds.length === 0) return [];
  
  // Batch size: 150 team IDs (safe for 8 KB URL limit with ~45% safety margin)
  // Each UUID is ~36 chars; 150 IDs ≈ 5,450 chars total URL length
  const batchSize = 150;
  let allMembers: MemberRow[] = [];
  
  // Process team IDs in batches to avoid URL-length limit
  for (let i = 0; i < teamIds.length; i += batchSize) {
    const batchIds = teamIds.slice(i, i + batchSize);
    
    // Paginate within each batch to handle 1,000+ member result sets
    const pageSize = 1000;
    let offset = 0;
    
    while (true) {
      const { data, error } = await client()
        .from("team_members")
        .select("*")
        .in("team_id", batchIds)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);
      
      if (error) throw error;
      const page = (data ?? []) as MemberRow[];
      allMembers.push(...page);
      
      // Stop when page has fewer than pageSize rows (indicates last page for this batch)
      if (page.length < pageSize) break;
      offset += pageSize;
    }
  }
  
  // Sort across batches to preserve created_at ASC ordering
  // (member timestamps can overlap across different team ID batches)
  allMembers.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  return allMembers;
}

export async function getFullTeam(id: string): Promise<FullTeam> {
  const [{ data: team, error: te }, { data: members, error: me }] = await Promise.all([
    client().from("teams").select("*").eq("id", id).single(),
    client().from("team_members").select("*").eq("team_id", id).order("created_at"),
  ]);
  if (te) throw te;
  if (me) throw me;
  return { ...(team as TeamRow), members: (members ?? []) as MemberRow[] };
}

export async function updateTeamStatus(id: string, status: Status, actor: string | null) {
  const { error } = await client().from("teams").update({ status }).eq("id", id);
  if (error) throw error;
  await logAudit(actor, "status_update", "team", id, { status });
}

export async function updateTeamNotes(id: string, notes: string, actor: string | null) {
  const { error } = await client().from("teams").update({ notes }).eq("id", id);
  if (error) throw error;
  await logAudit(actor, "notes_update", "team", id, {});
}

export async function deleteTeams(ids: string[], actor: string | null) {
  // Short-circuit for empty array (preserve existing behavior)
  if (ids.length === 0) return;
  
  // Batch size: 150 team IDs (same rationale as listMembersFor - URL safety)
  const batchSize = 150;
  
  // Process deletions in batches sequentially (fail-fast on errors)
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    
    // Delete this batch
    const { error } = await client().from("teams").delete().in("id", batchIds);
    
    // Fail-fast: throw error immediately on first batch failure
    // This surfaces partial failures rather than silently continuing
    if (error) throw error;
    
    // Write audit logs for successfully deleted batch
    for (const id of batchIds) {
      await logAudit(actor, "delete", "team", id, {});
    }
  }
}

// ── V2: Shortlisted Teams Import ──────────────────────────────────────────

export type ShortlistedTeamRow = {
  team_id: string;
  registration_source: "WEBSITE" | "UNSTOP";
  team_name: string;
  team_lead_name: string;
  contact: string;
  email: string;
  team_size: number;
  amount: number;
  payment_status: "PENDING";
  payment_notes: string | null;
};

/**
 * Passes a validated array of rows to the import_shortlisted_teams() RPC.
 * The RPC handles all business logic and runs atomically inside Postgres.
 * Returns { imported: number } on success, throws on any error.
 */
export async function importShortlisted(
  rows: ShortlistedTeamRow[]
): Promise<{ imported: number }> {
  const { data, error } = await client().rpc("import_shortlisted_teams", {
    rows,
  });

  if (error) {
    // Supabase RPC errors are plain objects { code, message, details, hint },
    // not Error instances. Extract the human-readable message explicitly so
    // the UI never shows "[object Object]".
    console.error("[importShortlisted] RPC error:", error);
    const msg =
      (typeof error === "object" && error !== null && "message" in error
        ? (error as { message?: string }).message
        : null) ??
      String(error);
    throw new Error(msg || "Import failed. Check the browser console for details.");
  }

  return data as { imported: number };
}

/**
 * Fires the sync-sheet Edge Function for the supplied team IDs.
 * Fire-and-forget from the frontend — never throws, never blocks the import.
 * Errors are logged to the console only.
 */
export async function syncSheetForTeams(teamIds: string[]): Promise<void> {
  if (teamIds.length === 0) return;
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const edgeUrl     = `${supabaseUrl}/functions/v1/sync-sheet`;

    const res = await fetch(edgeUrl, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ teamIds }),
    });

    const body = await res.json() as { success: boolean; message?: string; synced?: number };
    if (!body.success) {
      console.warn("[syncSheetForTeams] Sheet sync reported failure:", body.message);
    } else {
      console.log(`[syncSheetForTeams] Synced ${body.synced} row(s) to Automation Sheet.`);
    }
  } catch (err) {
    // Never propagate — sheet sync failure must not affect CSV import success.
    console.error("[syncSheetForTeams] Unexpected error:", err);
  }
}

// ── V2: Payment Dashboard ─────────────────────────────────────────────────

export type ShortlistedTeamFull = {
  id:                           string;
  team_id:                      string;
  registration_source:          string;
  team_name:                    string;
  team_lead_name:               string;
  contact:                      string;
  email:                        string | null;
  team_size:                    number;
  amount:                       number;
  payment_status:               "PENDING" | "FAILED" | "PAID";
  payment_notes:                string | null;
  paid_at:                      string | null;
  created_at:                   string;
  auth_id:                      string | null;
  shortlisted_email_status:     "NOT_SENT" | "SENDING" | "SENT" | "FAILED";
  shortlisted_email_sent_at:    string | null;
  shortlisted_email_message_id: string | null;
  shortlisted_email_error:      string | null;
};

export type PaymentEvent = {
  id:                  string;
  shortlisted_team_id: string;
  razorpay_order_id:   string | null;
  razorpay_payment_id: string | null;
  event_type:          string;
  amount:              number;
  payload:             Record<string, unknown>;
  signature_verified:  boolean | null;
  created_at:          string;
  auth_id:             string | null;
};

export async function listShortlistedTeams(): Promise<ShortlistedTeamFull[]> {
  const { data, error } = await client()
    .from("shortlisted_teams")
    .select("*")
    .order("team_id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ShortlistedTeamFull[];
}

export async function listPaymentEventsForTeam(
  shortlistedTeamId: string
): Promise<PaymentEvent[]> {
  const { data, error } = await client()
    .from("payment_events")
    .select("*")
    .eq("shortlisted_team_id", shortlistedTeamId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PaymentEvent[];
}

/**
 * Updates payment_notes on a shortlisted_teams row.
 * Only touches payment_notes — never modifies payment_status, amount,
 * paid_at or any other field. Admin-only via service-role client.
 */
export async function updatePaymentNotes(
  id: string,
  notes: string
): Promise<void> {
  const trimmed = notes.trim().slice(0, 1000);
  const { error } = await client()
    .from("shortlisted_teams")
    .update({ payment_notes: trimmed || null })
    .eq("id", id);
  if (error) throw error;
}

export async function markPaymentAsPaid(
  id: string
): Promise<void> {
  const { error } = await client()
    .from("shortlisted_teams")
    .update({ payment_status: "PAID", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function logAudit(
  actor: string | null,
  action: string,
  target_type: string,
  target_id: string,
  meta: Record<string, unknown>
) {
  try {
    await client()
      .from("audit_log")
      .insert({ actor, action, target_type, target_id, meta });
  } catch {
    // Non-fatal if audit fails — never block admin actions.
  }
}

export async function listAudit(limit = 50) {
  const { data, error } = await client()
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/**
 * Request a short-lived (10-minute) presigned R2 download URL for a team's
 * abstract via the get-abstract-url Edge Function.
 *
 * The R2 object key and bucket credentials are never exposed to the browser.
 * Only the signed URL is returned.
 *
 * @param teamId  - Public Team ID, e.g. "SPEC2026-0042"
 * @param session - Active Supabase session (provides the JWT for the Edge Function)
 */
export async function getAbstractDownloadUrl(
  teamId: string,
  accessToken: string,
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/get-abstract-url`;

  const res = await fetch(edgeUrl, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ teamId }),
  });

  const body = await res.json() as { success: boolean; signedUrl?: string; message?: string };

  if (!res.ok || !body.success) {
    throw new Error(body.message ?? `Failed to generate download URL (${res.status}).`);
  }

  return body.signedUrl!;
}

/**
 * Fetch signed R2 URLs for every team that has an abstract, download each
 * PPTX, package them into a ZIP named by Team ID, and trigger a browser
 * download of the ZIP file.
 *
 * Uses fflate for in-browser ZIP creation (no server round-trip needed).
 * Files in the ZIP are named  SPEC2026-0001.pptx, SPEC2026-0002.pptx, …
 *
 * @param teams       - Subset of teams to include (caller applies any filter)
 * @param accessToken - Admin JWT used to call get-abstract-url
 * @param onProgress  - Optional callback(completed, total) for progress updates
 */
export async function downloadAllAbstracts(
  teams: TeamRow[],
  accessToken: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Only include teams that actually have an abstract stored
  const withAbstract = teams.filter((t) => t.abstract_url && t.reg_code);
  if (withAbstract.length === 0) throw new Error("No abstracts found for the selected teams.");

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/get-abstract-url`;

  // Fetch all signed URLs in parallel (concurrency-limited to avoid rate limits)
  const CONCURRENCY = 5;
  const files: { name: string; data: Uint8Array }[] = [];
  let completed = 0;

  for (let i = 0; i < withAbstract.length; i += CONCURRENCY) {
    const batch = withAbstract.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (team) => {
        // Get signed URL from Edge Function
        const res = await fetch(edgeUrl, {
          method:  "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${accessToken}` },
          body:    JSON.stringify({ teamId: team.reg_code }),
        });
        const body = await res.json() as { success: boolean; signedUrl?: string; message?: string };
        if (!res.ok || !body.success) throw new Error(`${team.reg_code}: ${body.message ?? "failed"}`);

        // Download the PPTX binary
        const fileRes = await fetch(body.signedUrl!);
        if (!fileRes.ok) throw new Error(`${team.reg_code}: download failed (${fileRes.status})`);
        const buffer = await fileRes.arrayBuffer();
        return { name: `${team.reg_code}.pptx`, data: new Uint8Array(buffer as ArrayBuffer) };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        files.push(result.value);
      }
      // Rejected entries are silently skipped — we include all successful ones
    }

    completed += batch.length;
    onProgress?.(Math.min(completed, withAbstract.length), withAbstract.length);
  }

  if (files.length === 0) throw new Error("All abstract downloads failed. Check your connection and try again.");

  // Build ZIP in-browser using fflate
  const { zip } = await import("fflate");

  const zipInput: Record<string, Uint8Array> = {};
  for (const f of files) {
    zipInput[f.name] = f.data;
  }

  const zipBytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(zipInput, { level: 0 }, (err, data) => {
      // level:0 = store only (no compression for PPTX which are already compressed)
      if (err) reject(err);
      else resolve(data);
    });
  });

  // Trigger browser download
  const blob = new Blob([zipBytes as Uint8Array<ArrayBuffer>], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `SPECATHON2026_Abstracts_${date}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}


/**
 * Provisions credentials for a shortlisted team by invoking the provision-team-credentials Edge Function.
 */
export async function provisionTeamCredentials(
  teamId: string,
  accessToken: string
): Promise<{ success: boolean; teamId?: string; password?: string; message?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/provision-team-credentials`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ teamId }),
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to provision credentials (${res.status}).`);
  }
  return body as { success: boolean; teamId?: string; password?: string; message?: string };
}

export type BulkProvisionResult = {
  success: boolean;
  results?: {
    ALREADY_PROVISIONED: string[];
    LEGACY: string[];
    INCONSISTENT: string[];
    PROVISIONED: { teamId: string; password: string }[];
    ORPHANED_AUTH: string[];
    FAILED: string[];
  };
  message?: string;
};

/**
 * Provisions credentials in bulk for all eligible shortlisted teams.
 */
export async function bulkProvisionCredentials(
  accessToken: string
): Promise<BulkProvisionResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/bulk-provision-credentials`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    }
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to bulk provision credentials (${res.status}).`);
  }
  return body as BulkProvisionResult;
}

/**
 * Retrieves the plaintext credential for a single already-provisioned team.
 */
export async function getTeamCredential(
  accessToken: string,
  teamId: string
): Promise<{ success: boolean; password?: string; message?: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/get-team-credential`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ teamId })
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to retrieve team credential (${res.status}).`);
  }
  return body as { success: boolean; password?: string; message?: string };
}

// --- Spin Wheel Services ---

export type WheelConfig = {
  id: number;
  is_enabled: boolean;
  current_mode: "TEST" | "LIVE";
  prize_1_name: string;
  prize_2_name: string;
  better_luck_a_name: string;
  better_luck_b_name: string;
  dummy_1_name: string;
  dummy_2_name: string;
  dummy_3_name: string;
  dummy_4_name: string;
};

export type SpinAttempt = {
  id: string;
  shortlisted_team_id: string;
  auth_id: string;
  mode: "TEST" | "LIVE";
  result: "PRIZE_1" | "PRIZE_2" | "BETTER_LUCK_A" | "BETTER_LUCK_B";
  created_at: string;
  team?: {
    team_id: string;
    team_name: string;
  };
};

export async function getWheelConfig(): Promise<WheelConfig> {
  const { data, error } = await client().from("wheel_config").select("*").eq("id", 1).single();
  if (error) throw error;
  return data;
}

export async function updateWheelConfig(updates: Partial<Omit<WheelConfig, "id">>): Promise<void> {
  const { error } = await client().from("wheel_config").update(updates).eq("id", 1);
  if (error) throw error;
}

export async function listSpinAttempts(): Promise<SpinAttempt[]> {
  const { data, error } = await client()
    .from("spin_attempts")
    .select(`
      *,
      team:shortlisted_teams(team_id, team_name)
    `)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function sendShortlistedEmail(teamId: string, token: string, resend: boolean = false): Promise<{
  success: boolean;
  message?: string;
}> {
  const { data, error } = await client().functions.invoke("send-shortlisted-email", {
    body: { team_id: teamId, resend },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) {
    throw new Error(error.message || "Failed to invoke send-shortlisted-email function");
  }

  if (!data?.success) {
    throw new Error(data?.message || "Failed to send email");
  }

  return data;
}

export type BulkEmailResult = {
  success: boolean;
  total: number;
  sent: number;
  failed: number;
  results: { team_id: string; success: boolean; error?: string }[];
  message?: string;
};

export async function sendBulkShortlistedEmails(teamIds: string[], token: string): Promise<BulkEmailResult> {
  const { data, error } = await client().functions.invoke("send-shortlisted-emails", {
    body: { team_ids: teamIds },
    headers: { Authorization: `Bearer ${token}` }
  });

  if (error) {
    throw new Error(error.message || "Failed to invoke send-shortlisted-emails function");
  }

  if (!data?.success) {
    throw new Error(data?.message || "Failed to send bulk emails");
  }

  return data as BulkEmailResult;
}


export type EmailTemplate = {
  subject: string;
  html: string;
};

export async function getEmailTemplate(token: string, key: string = "shortlisted_team"): Promise<EmailTemplate> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/admin-email-template?key=${key}`;

  const res = await fetch(edgeUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    }
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to fetch email template (${res.status}).`);
  }
  if (!body.success) {
    throw new Error(body.message || "Failed to fetch email template.");
  }
  return body.template as EmailTemplate;
}

export async function saveEmailTemplate(token: string, subject: string, html: string, key: string = "shortlisted_team"): Promise<EmailTemplate> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/admin-email-template?key=${key}`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ subject, html })
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to save email template (${res.status}).`);
  }
  if (!body.success) {
    throw new Error(body.message || "Failed to save email template.");
  }
  return body.template as EmailTemplate;
}

export type DeleteTeamRecordResult = {
  success: boolean;
  results?: {
    DELETED: string[];
    SKIPPED_PAYMENT_EVENTS: string[];
    FAILED: { teamId: string; error: string }[];
  };
  message?: string;
};

/**
 * Deletes team records safely via the delete-team-record Edge Function.
 * Only deletes V2 operational/test records. Preserves V1 and payment_events.
 */
export async function deleteTeamRecords(
  teamIds: string[],
  accessToken: string
): Promise<DeleteTeamRecordResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const edgeUrl = `${supabaseUrl}/functions/v1/delete-team-record`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ teamIds })
  });

  const body = await res.json();
  if (!res.ok && !body.message) {
    throw new Error(`Failed to delete team records (${res.status}).`);
  }
  return body as DeleteTeamRecordResult;
}
