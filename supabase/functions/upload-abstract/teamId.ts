import { SupabaseClient } from "npm:@supabase/supabase-js@^2";

/**
 * Obtain the next sequence value from Postgres and format it as
 * SPEC2026-NNNN (zero-padded to 4 digits, growing beyond 4 as needed).
 *
 * The underlying nextval() call is atomic — Postgres serialises all
 * concurrent callers, so two simultaneous registrations will always
 * receive different sequence values and therefore different Team IDs.
 *
 * Requires the migration 0004_team_id_sequence.sql to have been applied
 * (creates the public.team_id_seq sequence and next_team_seq() RPC).
 */
export async function generateTeamId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.rpc("next_team_seq");

  if (error) {
    throw new Error(`Failed to generate Team ID: ${error.message}`);
  }

  // nextval returns bigint; Supabase JS surfaces it as number or string
  const n = Number(data);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Unexpected sequence value: ${data}`);
  }

  // Format: SPEC2026-0001, SPEC2026-0042, SPEC2026-1000, …
  const padded = String(n).padStart(4, "0");
  const EVENT_PREFIX = Deno.env.get("EVENT_PREFIX") ?? "SPEC2026";
  return `${EVENT_PREFIX}-${padded}`;
}
