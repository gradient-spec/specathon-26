/**
 * Event-stage helpers — ported from the standalone leaderboard app's
 * `server/schedule.ts`. Pure + deterministic so the client can show the
 * effective stage immediately without waiting for a server tick.
 *
 * The canonical stage still lives in Supabase; `leaderboard_tick_stage()`
 * persists the schedule-derived value. This mirror only affects display
 * between ticks.
 */

export const STAGES = [
  "ROUND_1_UPCOMING", "ROUND_1_LIVE", "ROUND_1_COMPLETED",
  "ROUND_2_UPCOMING", "ROUND_2_LIVE", "ROUND_2_COMPLETED",
  "FINAL_UPCOMING", "FINAL_LIVE", "FINAL_COMPLETED", "RESULTS_LIVE",
] as const;
export type Stage = (typeof STAGES)[number];

export type StageSchedule = {
  round1StartAt: string | Date | null;
  round1EndAt: string | Date | null;
  round2StartAt: string | Date | null;
  round2EndAt: string | Date | null;
  finalStartAt: string | Date | null;
  finalEndAt: string | Date | null;
};

type Phase = {
  upcoming: Stage;
  live: Stage;
  completed: Stage;
  startAt: Date | null;
  endAt: Date | null;
};

const asDate = (v: string | Date | null): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Returns the stage implied by the schedule at `now`, or `null` when the
 * schedule can't determine it (e.g. Round 1 has no start time) — callers keep
 * the manually-set stage in that case. RESULTS_LIVE is never produced here.
 */
export function scheduledStage(
  schedule: StageSchedule,
  now: Date = new Date(),
): Stage | null {
  const t = now.getTime();
  const phases: Phase[] = [
    { upcoming: "ROUND_1_UPCOMING", live: "ROUND_1_LIVE", completed: "ROUND_1_COMPLETED", startAt: asDate(schedule.round1StartAt), endAt: asDate(schedule.round1EndAt) },
    { upcoming: "ROUND_2_UPCOMING", live: "ROUND_2_LIVE", completed: "ROUND_2_COMPLETED", startAt: asDate(schedule.round2StartAt), endAt: asDate(schedule.round2EndAt) },
    { upcoming: "FINAL_UPCOMING", live: "FINAL_LIVE", completed: "FINAL_COMPLETED", startAt: asDate(schedule.finalStartAt), endAt: asDate(schedule.finalEndAt) },
  ];

  let lastCompleted: Stage | null = null;
  for (const phase of phases) {
    if (!phase.startAt) return lastCompleted;
    if (t < phase.startAt.getTime()) return phase.upcoming;
    if (phase.endAt && t >= phase.endAt.getTime()) {
      lastCompleted = phase.completed;
      continue;
    }
    return phase.live;
  }
  return lastCompleted;
}
