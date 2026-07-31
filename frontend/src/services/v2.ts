/**
 * SPECATHON 2026 · V2 — Public API client
 *
 * Thin wrappers around the V2 Edge Functions.
 * All functions derive the Edge Function URL from the same
 * VITE_SUPABASE_URL env var used throughout the project.
 */

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function edgeUrl(fn: string): string {
  return `${SUPA_URL}/functions/v1/${fn}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization:  `Bearer ${ANON_KEY}`,
    ...extra,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ShortlistedTeam = {
  team_id:        string;
  team_name:      string;
  team_lead_name: string;
};

// ── shortlisted-teams ─────────────────────────────────────────────────────────

export async function fetchShortlistedTeams(
  query?: string
): Promise<ShortlistedTeam[]> {
  const url = new URL(edgeUrl("shortlisted-teams"));
  if (query?.trim()) url.searchParams.set("q", query.trim());

  const res  = await fetch(url.toString(), {
    method:  "GET",
    headers: headers(),
  });
  const body = await res.json() as { success: boolean; teams?: ShortlistedTeam[]; message?: string };

  if (!res.ok || !body.success) {
    throw new Error(body.message ?? `Failed to fetch teams (${res.status}).`);
  }

  return body.teams ?? [];
}
