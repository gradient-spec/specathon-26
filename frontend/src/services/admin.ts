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
