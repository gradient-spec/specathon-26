import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@^2";

// ── Types ────────────────────────────────────────────────────────────────────

export type MemberInput = {
  name:       string;
  email?:     string;
  phone?:     string;
  college?:   string;
  department?: string;
  year?:      string;
  roll_number?: string;
};

export type RegistrationInput = {
  // Identity
  teamId:        string;   // SPEC2026-NNNN
  r2Key:         string;   // specathon-2026/abstracts/SPEC2026-NNNN.pptx
  originalName:  string;   // original filename from the upload

  // Team
  teamName:      string;
  teamSize:      number;
  domain:        string;
  projectTitle:  string;

  // Leader
  leaderName:    string;
  leaderEmail:   string;
  leaderPhone:   string;
  college:       string;
  isInternal:    boolean;
  leaderYear?:   string;
  leaderRoll?:   string;
  leaderDept?:   string;
  collegeState?: string;
  collegeCity?:  string;

  // Members (non-leader)
  members: MemberInput[];

  // Declarations
  paymentAck:        boolean;
  templateConfirmed: boolean;
};

// ── Client factory ───────────────────────────────────────────────────────────

/**
 * Build a Supabase client using the service_role key.
 * The service_role key bypasses RLS and is required for server-side writes
 * that call the register_team() SECURITY DEFINER RPC.
 *
 * These values must be set as Supabase Edge Function secrets:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
export function createSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) throw new Error("Missing secret: SUPABASE_URL");
  if (!key) throw new Error("Missing secret: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Save registration ────────────────────────────────────────────────────────

/**
 * Persist the full registration using the existing register_team() RPC.
 *
 * The RPC runs as SECURITY DEFINER inside a single PL/pgSQL block, so the
 * team row and all member rows are inserted atomically — either everything
 * lands or nothing does.
 *
 * We reuse the existing RPC rather than inserting directly into tables so
 * that all server-side validation (field lengths, email format, duplicate
 * email guard, status default) stays in one place.
 *
 * Fields mapped:
 *   teams.reg_code      ← teamId        (SPEC2026-NNNN)
 *   teams.abstract_url  ← r2Key         (R2 object key)
 *   teams.payment_ack   ← paymentAck
 *   (templateConfirmed is stored in teams.notes as a flag for traceability)
 */
export async function saveRegistration(
  client: SupabaseClient,
  input: RegistrationInput,
): Promise<{ id: string; reg_code: string }> {

  const team = {
    // Public ID — stored in reg_code, overriding the UUID-derived default
    reg_code:           input.teamId,

    team_name:          input.teamName,
    team_size:          input.teamSize,
    domain:             input.domain,
    project_title:      input.projectTitle,

    leader_name:        input.leaderName,
    email:              input.leaderEmail,
    phone:              input.leaderPhone,
    college:            input.college,
    is_internal:        input.isInternal,
    leader_year:        input.leaderYear        ?? "",
    leader_roll:        input.leaderRoll        ?? "",
    leader_department:  input.leaderDept        ?? "",
    college_state:      input.collegeState      ?? "",
    college_city:       input.collegeCity       ?? "",

    abstract_url:       input.r2Key,
    payment_ack:        input.paymentAck,

    // Store template confirmation and original filename in notes
    // so the admin dashboard can display them without a schema change.
    notes: JSON.stringify({
      template_confirmed: input.templateConfirmed,
      original_filename:  input.originalName,
    }),
  };

  const members = input.members.map((m) => ({
    name:        m.name,
    email:       m.email       ?? "",
    phone:       m.phone       ?? "",
    year:        m.year        ?? "",
    roll_number: m.roll_number ?? "",
    department:  m.department  ?? "",
  }));

  const { data, error } = await client.rpc("register_team", { team, members });

  if (error) {
    // Re-throw with the original Postgres message so the caller can
    // map known error codes (23505 = duplicate email) to user-facing text.
    throw Object.assign(
      new Error(error.message ?? "Registration database insert failed."),
      { code: error.code },
    );
  }

  if (!data) {
    throw new Error("register_team returned no data.");
  }

  return data as { id: string; reg_code: string };
}
