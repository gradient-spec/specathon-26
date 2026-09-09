import { describe, expect, it } from "vitest";
import { scheduledStage, type StageSchedule } from "./schedule";

const empty: StageSchedule = {
  round1StartAt: null, round1EndAt: null,
  round2StartAt: null, round2EndAt: null,
  finalStartAt: null, finalEndAt: null,
};
const d = (iso: string) => new Date(iso);

describe("scheduledStage", () => {
  it("returns null when nothing is scheduled", () => {
    expect(scheduledStage(empty, d("2026-09-10T10:00:00Z"))).toBeNull();
  });

  it("is UPCOMING before the round 1 start", () => {
    const s = { ...empty, round1StartAt: d("2026-09-10T09:00:00Z"), round1EndAt: d("2026-09-10T17:00:00Z") };
    expect(scheduledStage(s, d("2026-09-10T08:59:00Z"))).toBe("ROUND_1_UPCOMING");
  });

  it("is LIVE between round 1 start and end", () => {
    const s = { ...empty, round1StartAt: d("2026-09-10T09:00:00Z"), round1EndAt: d("2026-09-10T17:00:00Z") };
    expect(scheduledStage(s, d("2026-09-10T12:00:00Z"))).toBe("ROUND_1_LIVE");
  });

  it("stays LIVE with no end time set", () => {
    const s = { ...empty, round1StartAt: d("2026-09-10T09:00:00Z") };
    expect(scheduledStage(s, d("2027-01-01T00:00:00Z"))).toBe("ROUND_1_LIVE");
  });

  it("reports the previous phase COMPLETED when the next has no start yet", () => {
    const s = { ...empty, round1StartAt: d("2026-09-10T09:00:00Z"), round1EndAt: d("2026-09-10T17:00:00Z") };
    expect(scheduledStage(s, d("2026-09-10T18:00:00Z"))).toBe("ROUND_1_COMPLETED");
  });

  it("advances into round 2 once its window opens", () => {
    const s: StageSchedule = {
      round1StartAt: d("2026-09-10T09:00:00Z"), round1EndAt: d("2026-09-10T17:00:00Z"),
      round2StartAt: d("2026-09-11T09:00:00Z"), round2EndAt: d("2026-09-11T15:00:00Z"),
      finalStartAt: null, finalEndAt: null,
    };
    expect(scheduledStage(s, d("2026-09-10T20:00:00Z"))).toBe("ROUND_2_UPCOMING");
    expect(scheduledStage(s, d("2026-09-11T10:00:00Z"))).toBe("ROUND_2_LIVE");
    expect(scheduledStage(s, d("2026-09-11T16:00:00Z"))).toBe("ROUND_2_COMPLETED");
  });

  it("walks through the final and never auto-flips to RESULTS_LIVE", () => {
    const s: StageSchedule = {
      round1StartAt: d("2026-09-10T09:00:00Z"), round1EndAt: d("2026-09-10T17:00:00Z"),
      round2StartAt: d("2026-09-11T09:00:00Z"), round2EndAt: d("2026-09-11T15:00:00Z"),
      finalStartAt: d("2026-09-11T18:00:00Z"), finalEndAt: d("2026-09-11T20:00:00Z"),
    };
    expect(scheduledStage(s, d("2026-09-11T19:00:00Z"))).toBe("FINAL_LIVE");
    expect(scheduledStage(s, d("2026-09-11T21:00:00Z"))).toBe("FINAL_COMPLETED");
  });
});
