/**
 * SPECATHON 2026 · V2 — Public API client
 *
 * Thin wrappers around the V2 Edge Functions.
 * All functions derive the Edge Function URL from the same
 * VITE_SUPABASE_URL env var used throughout the project.
 */

const SUPA_URL  = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function edgeUrl(fn: string): string {
  if (!SUPA_URL) {
    throw new Error(
      "VITE_SUPABASE_URL is not configured. " +
      "Please add it to frontend/.env (see frontend/.env.example for template)."
    );
  }
  return `${SUPA_URL}/functions/v1/${fn}`;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  if (!ANON_KEY) {
    throw new Error(
      "VITE_SUPABASE_ANON_KEY is not configured. " +
      "Please add it to frontend/.env (see frontend/.env.example for template)."
    );
  }
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

// ── shortlisted-teams: exact Team ID lookup (public shortlist search) ──────────

export type ShortlistLookupResult =
  | { state: "shortlisted"; team: ShortlistedTeam }
  | { state: "not_shortlisted" }
  | { state: "not_registered" };

/**
 * Looks up a single Team ID against the real shortlisted_teams /
 * teams tables (via the shortlisted-teams Edge Function's teamId= mode).
 * Never returns payment_status, payment_notes, paid_at, amount or contact —
 * those columns are not selected by the Edge Function at all.
 */
export async function checkShortlistStatus(teamId: string): Promise<ShortlistLookupResult> {
  const url = new URL(edgeUrl("shortlisted-teams"));
  url.searchParams.set("teamId", teamId.trim());

  const res  = await fetch(url.toString(), { method: "GET", headers: headers() });
  const body = await res.json() as {
    success: boolean;
    state?: "shortlisted" | "not_shortlisted" | "not_registered";
    team?: ShortlistedTeam;
    message?: string;
  };

  if (!res.ok || !body.success || !body.state) {
    throw new Error(body.message ?? `Lookup failed (${res.status}).`);
  }

  if (body.state === "shortlisted" && body.team) {
    return { state: "shortlisted", team: body.team };
  }
  return { state: body.state === "shortlisted" ? "not_registered" : body.state };
}

// ── validate-team ─────────────────────────────────────────────────────────────

export type ValidatedTeam = {
  team_id:        string;
  team_name:      string;
  team_lead_name: string;
  team_size:      number;
  amount:         number;
};

export async function validateTeam(teamId: string): Promise<ValidatedTeam> {
  const res  = await fetch(edgeUrl("validate-team"), {
    method:  "POST",
    headers: headers(),
    body:    JSON.stringify({ teamId }),
  });
  const body = await res.json() as { success: boolean; team?: ValidatedTeam; message?: string };

  if (!res.ok || !body.success) {
    throw new Error(body.message ?? `Validation failed (${res.status}).`);
  }

  return body.team!;
}

// ── create-payment-order ──────────────────────────────────────────────────────

export type PaymentOrder = {
  id:       string;
  amount:   number;
  currency: string;
};

export async function createPaymentOrder(
  teamId: string
): Promise<{ provider: string; order: PaymentOrder }> {
  const res  = await fetch(edgeUrl("create-payment-order"), {
    method:  "POST",
    headers: headers(),
    body:    JSON.stringify({ teamId }),
  });
  const body = await res.json() as {
    success:  boolean;
    provider?: string;
    order?:   PaymentOrder;
    message?: string;
  };

  if (!res.ok || !body.success) {
    throw new Error(body.message ?? `Failed to create order (${res.status}).`);
  }

  return { provider: body.provider!, order: body.order! };
}

// ── payment-callback ──────────────────────────────────────────────────────────

export async function submitPaymentCallback(params: {
  orderId:   string;
  paymentId: string;
  status:    "SUCCESS" | "FAILED";
}): Promise<void> {
  const res  = await fetch(edgeUrl("payment-callback"), {
    method:  "POST",
    headers: headers(),
    body:    JSON.stringify(params),
  });
  const body = await res.json() as { success: boolean; message?: string };

  if (!res.ok || !body.success) {
    throw new Error(body.message ?? `Callback failed (${res.status}).`);
  }
}
