import type { RankedRow } from "./ranking";

export type EventSettings = {
  id: number;
  currentStage: string;
  round1MaxScore: number;
  round2MaxScore: number;
  autoAdvance: boolean;
  round1StartAt: string | null;
  round1EndAt: string | null;
  round2StartAt: string | null;
  round2EndAt: string | null;
  finalStartAt: string | null;
  finalEndAt: string | null;
  updatedAt: string;
};

export type VenueGroup = {
  id: number;
  groupName: string;
  venues: string[];
};

export type TeamScoreRow = {
  id: number;
  teamId: string;
  teamName: string;
  venue: string;
  round1Score: number | null;
  round2Score: number | null;
};

export type AuditRow = {
  id: number;
  teamId: string;
  teamName: string;
  round: "ROUND_1" | "ROUND_2";
  oldScore: number | null;
  newScore: number | null;
  changedBy: string | null;
  changedAt: string;
};

export type LeaderboardData = {
  settings: EventSettings;
  groups: VenueGroup[];
  teams: RankedRow[];
};

export type AdminSummary = {
  settings: EventSettings;
  totalTeams: number;
  round1Evaluated: number;
  round2Evaluated: number;
  recentAudit: AuditRow[];
};

export type SettingsInput = {
  currentStage: string;
  round1MaxScore: number;
  round2MaxScore: number;
  autoAdvance: boolean;
  round1StartAt: string | null;
  round1EndAt: string | null;
  round2StartAt: string | null;
  round2EndAt: string | null;
  finalStartAt: string | null;
  finalEndAt: string | null;
};
