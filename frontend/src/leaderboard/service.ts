/**
 * SPECATHON 2026 · Live Leaderboard — data-access layer.
 *
 * Replaces the standalone app's tRPC router. Public reads hit the
 * `leaderboard_*` tables directly (world-readable via RLS); every write is
 * gated by `is_admin()` — either by RLS (venue groups, team details,
 * settings) or by a SECURITY DEFINER RPC (scores + audit, roster import).
 */

import { supabase } from "@/services/supabase";
import { rankLeaderboardRows, type RankingInput } from "./ranking";
import { scheduledStage } from "./schedule";
import type {
  AdminSummary,
  AuditRow,
  EventSettings,
  LeaderboardData,
  SettingsInput,
  TeamScoreRow,
  VenueGroup,
} from "./types";

function client() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

/* ── mappers ─────────────────────────────────────────────────────────── */

type SettingsDbRow = {
  id: number;
  current_stage: string;
  round1_max_score: number;
  round2_max_score: number;
  auto_advance: boolean;
  round1_start_at: string | null;
  round1_end_at: string | null;
  round2_start_at: string | null;
  round2_end_at: string | null;
  final_start_at: string | null;
  final_end_at: string | null;
  updated_at: string;
};

function mapSettings(row: SettingsDbRow): EventSettings {
  return {
    id: row.id,
    currentStage: row.current_stage,
    round1MaxScore: row.round1_max_score,
    round2MaxScore: row.round2_max_score,
    autoAdvance: row.auto_advance,
    round1StartAt: row.round1_start_at,
    round1EndAt: row.round1_end_at,
    round2StartAt: row.round2_start_at,
    round2EndAt: row.round2_end_at,
    finalStartAt: row.final_start_at,
    finalEndAt: row.final_end_at,
    updatedAt: row.updated_at,
  };
}

/** Overlay the schedule-derived stage for display between server ticks. */
function withEffectiveStage(s: EventSettings): EventSettings {
  if (!s.autoAdvance) return s;
  const derived = scheduledStage({
    round1StartAt: s.round1StartAt,
    round1EndAt: s.round1EndAt,
    round2StartAt: s.round2StartAt,
    round2EndAt: s.round2EndAt,
    finalStartAt: s.finalStartAt,
    finalEndAt: s.finalEndAt,
  });
  return derived && derived !== s.currentStage ? { ...s, currentStage: derived } : s;
}

type ScoreEmbed = { round1_score: number | null; round2_score: number | null };
type TeamDbRow = {
  id: number;
  team_id: string;
  team_name: string;
  venue: string;
  // PostgREST returns an array for a normal embed, or an object when it
  // detects the FK as to-one (leaderboard_scores.team_id is UNIQUE).
  leaderboard_scores: ScoreEmbed | ScoreEmbed[] | null;
};

function mapTeamRow(row: TeamDbRow): TeamScoreRow {
  const raw = row.leaderboard_scores;
  const score: ScoreEmbed | null = Array.isArray(raw) ? raw[0] ?? null : raw;
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    venue: row.venue,
    round1Score: score?.round1_score ?? null,
    round2Score: score?.round2_score ?? null,
  };
}

type GroupDbRow = {
  id: number;
  group_name: string;
  leaderboard_venue_group_members: { venue_name: string }[] | null;
};

function mapGroup(row: GroupDbRow): VenueGroup {
  return {
    id: row.id,
    groupName: row.group_name,
    venues: (row.leaderboard_venue_group_members ?? []).map((m) => m.venue_name),
  };
}

/* ── settings ────────────────────────────────────────────────────────── */

export async function getEventSettings(): Promise<EventSettings> {
  const { data, error } = await client()
    .from("leaderboard_event_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return withEffectiveStage(mapSettings(data as SettingsDbRow));
}

/** Best-effort persist of the schedule-derived stage (idempotent, anon-safe). */
export async function tickStage(): Promise<void> {
  try {
    await client().rpc("leaderboard_tick_stage");
  } catch {
    /* non-fatal — display still overlays the derived stage */
  }
}

/* ── teams / groups ──────────────────────────────────────────────────── */

async function getTeamRows(filters?: { search?: string; venue?: string }): Promise<TeamScoreRow[]> {
  let q = client()
    .from("leaderboard_teams")
    .select("id, team_id, team_name, venue, leaderboard_scores(round1_score, round2_score)")
    .order("team_name", { ascending: true });

  if (filters?.search) {
    const s = filters.search.replace(/[%,()]/g, "");
    q = q.or(`team_id.ilike.%${s}%,team_name.ilike.%${s}%`);
  }
  if (filters?.venue && filters.venue !== "ALL") {
    q = q.eq("venue", filters.venue);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data as TeamDbRow[] | null ?? []).map(mapTeamRow);
}

export async function getVenueGroups(): Promise<VenueGroup[]> {
  const { data, error } = await client()
    .from("leaderboard_venue_groups")
    .select("id, group_name, leaderboard_venue_group_members(venue_name)")
    .order("group_name", { ascending: true });
  if (error) throw error;
  return (data as GroupDbRow[] | null ?? []).map(mapGroup);
}

/* ── public payload ──────────────────────────────────────────────────── */

export async function getLeaderboardData(): Promise<LeaderboardData> {
  const [settings, rows, groups] = await Promise.all([
    getEventSettings(),
    getTeamRows(),
    getVenueGroups(),
  ]);
  const ranking: RankingInput[] = rows.map((r) => ({
    id: r.id,
    teamId: r.teamId,
    teamName: r.teamName,
    venue: r.venue,
    round1Score: r.round1Score,
    round2Score: r.round2Score,
  }));
  return { settings, groups, teams: rankLeaderboardRows(ranking, settings.currentStage) };
}

/* ── admin reads ─────────────────────────────────────────────────────── */

export async function getAuditLog(limit = 50): Promise<AuditRow[]> {
  const { data, error } = await client()
    .from("leaderboard_score_audit")
    .select("id, round, old_score, new_score, changed_by, changed_at, team:leaderboard_teams(team_id, team_name)")
    .order("changed_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  type Row = {
    id: number;
    round: "ROUND_1" | "ROUND_2";
    old_score: number | null;
    new_score: number | null;
    changed_by: string | null;
    changed_at: string;
    team: { team_id: string; team_name: string } | { team_id: string; team_name: string }[] | null;
  };
  return (data as Row[] | null ?? []).map((r) => {
    const team = Array.isArray(r.team) ? r.team[0] : r.team;
    return {
      id: r.id,
      teamId: team?.team_id ?? "—",
      teamName: team?.team_name ?? "Unknown team",
      round: r.round,
      oldScore: r.old_score,
      newScore: r.new_score,
      changedBy: r.changed_by,
      changedAt: r.changed_at,
    };
  });
}

export async function getAdminTeams(filters?: { search?: string; venue?: string }): Promise<TeamScoreRow[]> {
  return getTeamRows(filters);
}

export async function getAdminSummary(): Promise<AdminSummary> {
  const [settings, rows, recentAudit] = await Promise.all([
    getEventSettings(),
    getTeamRows(),
    getAuditLog(8),
  ]);
  return {
    settings,
    totalTeams: rows.length,
    round1Evaluated: rows.filter((r) => r.round1Score !== null).length,
    round2Evaluated: rows.filter((r) => r.round2Score !== null).length,
    recentAudit,
  };
}

/* ── admin writes ────────────────────────────────────────────────────── */

export async function setScore(teamId: number, round: "ROUND_1" | "ROUND_2", score: number) {
  const { error } = await client().rpc("leaderboard_set_score", {
    p_team_id: teamId,
    p_round: round,
    p_new_score: score,
  });
  if (error) throw new Error(error.message);
}

export async function clearScore(teamId: number, round: "ROUND_1" | "ROUND_2") {
  const { error } = await client().rpc("leaderboard_clear_score", {
    p_team_id: teamId,
    p_round: round,
  });
  if (error) throw new Error(error.message);
}

export async function updateTeam(id: number, teamName: string, venue: string) {
  const { error } = await client()
    .from("leaderboard_teams")
    .update({ team_name: teamName.trim(), venue: venue.trim().toUpperCase() || "TBD" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function importTeams(rows: { teamId: string; teamName: string; venue: string }[]) {
  const { data, error } = await client().rpc("leaderboard_import_teams", { rows });
  if (error) throw new Error(error.message);
  return (data as { count: number }).count;
}

export async function updateSettings(input: SettingsInput) {
  const { error } = await client()
    .from("leaderboard_event_settings")
    .update({
      current_stage: input.currentStage,
      round1_max_score: input.round1MaxScore,
      round2_max_score: input.round2MaxScore,
      auto_advance: input.autoAdvance,
      round1_start_at: input.round1StartAt,
      round1_end_at: input.round1EndAt,
      round2_start_at: input.round2StartAt,
      round2_end_at: input.round2EndAt,
      final_start_at: input.finalStartAt,
      final_end_at: input.finalEndAt,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  await tickStage();
}

export async function saveVenueGroup(id: number | undefined, groupName: string, venues: string[]) {
  const db = client();
  const cleanName = groupName.trim();
  const cleanVenues = Array.from(new Set(venues.map((v) => v.trim().toUpperCase()).filter(Boolean)));

  let groupId = id;
  if (groupId) {
    const { error } = await db.from("leaderboard_venue_groups").update({ group_name: cleanName }).eq("id", groupId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await db
      .from("leaderboard_venue_groups")
      .insert({ group_name: cleanName })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    groupId = (data as { id: number }).id;
  }

  await db.from("leaderboard_venue_group_members").delete().eq("group_id", groupId);
  if (cleanVenues.length) {
    const { error } = await db
      .from("leaderboard_venue_group_members")
      .insert(cleanVenues.map((venue_name) => ({ group_id: groupId, venue_name })));
    if (error) throw new Error(error.message);
  }
  return groupId;
}

export async function deleteVenueGroup(id: number) {
  const { error } = await client().from("leaderboard_venue_groups").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function seedVenueGroups() {
  const existing = await getVenueGroups();
  if (existing.length) return 0;
  const defaults = [
    { groupName: "G1 + G2", venues: ["G1", "G2"] },
    { groupName: "G20 + G21", venues: ["G20", "G21"] },
  ];
  for (const g of defaults) await saveVenueGroup(undefined, g.groupName, g.venues);
  return defaults.length;
}
