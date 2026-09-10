/**
 * Deterministic leaderboard ranking — ported verbatim from the standalone
 * leaderboard app's `server/ranking.ts` so the public ordering is identical.
 *
 * During ROUND_1_* stages only Round 1 counts toward rank; afterwards the
 * combined total ranks. Ties break on the Round 2 score, then team name.
 */

export type RankingInput = {
  id: number;
  teamId: string;
  teamName: string;
  venue: string;
  round1Score: number | null;
  round2Score: number | null;
};

export type RankedRow = RankingInput & {
  total: number;
  rankingTotal: number;
  round2Tie: number;
  rank: number;
};

export function rankLeaderboardRows(
  rows: RankingInput[],
  currentStage: string,
): RankedRow[] {
  const isRoundOne = currentStage.startsWith("ROUND_1");
  return rows
    .map((row) => {
      const total = (row.round1Score ?? 0) + (row.round2Score ?? 0);
      const rankingTotal = isRoundOne ? (row.round1Score ?? 0) : total;
      return { ...row, total, rankingTotal, round2Tie: row.round2Score ?? -1 };
    })
    .sort(
      (a, b) =>
        b.rankingTotal - a.rankingTotal ||
        b.round2Tie - a.round2Tie ||
        a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" }),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
