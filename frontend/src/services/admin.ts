import { supabase } from "./supabase";
import type { Status } from "../utils/constants";

export type TeamRow = {
  id: string;
  reg_code: string | null;
  created_at: string;
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
  created_at: string;
};

export type FullTeam = TeamRow & { members: MemberRow[] };

function client() {
  if (!supabase) throw new Error("Supabase not configured");
  return supabase;
}

export async function listTeams(): Promise<TeamRow[]> {
  const { data, error } = await client()
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeamRow[];
}

export async function listMembersFor(teamIds: string[]): Promise<MemberRow[]> {
  if (teamIds.length === 0) return [];
  const { data, error } = await client()
    .from("team_members")
    .select("*")
    .in("team_id", teamIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MemberRow[];
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
  if (ids.length === 0) return;
  const { error } = await client().from("teams").delete().in("id", ids);
  if (error) throw error;
  for (const id of ids) await logAudit(actor, "delete", "team", id, {});
}

// ── V2: Shortlisted Teams Import ──────────────────────────────────────────

export type ShortlistedTeamRow = {
  team_id: string;
  registration_source: "WEBSITE" | "UNSTOP";
  team_name: string;
  team_lead_name: string;
  contact: string;
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
  if (error) throw error;
  return data as { imported: number };
}

// ── V2: Payment Dashboard ─────────────────────────────────────────────────

export type ShortlistedTeamFull = {
  id:                  string;
  team_id:             string;
  registration_source: string;
  team_name:           string;
  team_lead_name:      string;
  contact:             string;
  team_size:           number;
  amount:              number;
  payment_status:      "PENDING" | "FAILED" | "PAID";
  payment_notes:       string | null;
  paid_at:             string | null;
  created_at:          string;
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
