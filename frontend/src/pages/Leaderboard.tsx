import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronDown, Crown, Radio, Timer } from "lucide-react";
import { getLeaderboardData, tickStage } from "@/leaderboard/service";
import type { LeaderboardData } from "@/leaderboard/types";
import type { RankedRow } from "@/leaderboard/ranking";
import "@/leaderboard/leaderboard.css";

const countdownTargets: Record<string, { label: string; field: keyof LeaderboardData["settings"] } | undefined> = {
  ROUND_1_UPCOMING: { label: "Round 1 starts in", field: "round1StartAt" },
  ROUND_1_LIVE: { label: "Round 1 ends in", field: "round1EndAt" },
  ROUND_2_UPCOMING: { label: "Round 2 starts in", field: "round2StartAt" },
  ROUND_2_LIVE: { label: "Round 2 ends in", field: "round2EndAt" },
  FINAL_UPCOMING: { label: "Final starts in", field: "finalStartAt" },
  FINAL_LIVE: { label: "Final ends in", field: "finalEndAt" },
};

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${days > 0 ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function Countdown({ settings }: { settings: LeaderboardData["settings"] | undefined }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const target = settings ? countdownTargets[settings.currentStage] : undefined;
  const rawAt = target && settings ? settings[target.field] : null;
  if (!target || !rawAt) return null;
  const remaining = new Date(rawAt as string).getTime() - now;
  if (remaining <= 0) return null;
  return (
    <div className="countdown-pill">
      <Timer size={13} />
      <span style={{ color: "#94a3b8" }}>{target.label}</span>
      <span className="countdown-value">{formatCountdown(remaining)}</span>
    </div>
  );
}

const stageCopy: Record<string, { label: string; tone: string; helper: string }> = {
  ROUND_1_UPCOMING: { label: "Round 1 upcoming", tone: "muted", helper: "Evaluation has not started" },
  ROUND_1_LIVE: { label: "Round 1 live", tone: "live", helper: "Scores are being recorded now" },
  ROUND_1_COMPLETED: { label: "Round 1 completed", tone: "complete", helper: "Round 2 is next" },
  ROUND_2_UPCOMING: { label: "Round 2 upcoming", tone: "muted", helper: "Round 1 results are locked" },
  ROUND_2_LIVE: { label: "Round 2 live", tone: "live", helper: "The leaderboard is moving in real time" },
  ROUND_2_COMPLETED: { label: "Round 2 completed", tone: "complete", helper: "Final evaluation is next" },
  FINAL_UPCOMING: { label: "Final upcoming", tone: "muted", helper: "Shortlist preparation in progress" },
  FINAL_LIVE: { label: "Final live", tone: "live", helper: "Final evaluation is underway" },
  FINAL_COMPLETED: { label: "Final completed", tone: "complete", helper: "Results are being prepared" },
  RESULTS_LIVE: { label: "Results live", tone: "complete", helper: "Official results are now visible" },
};

function PodiumCard({ team, place }: { team: RankedRow; place: 1 | 2 | 3 }) {
  return (
    <div className={`lb-podium-card p${place}`}>
      <span className={`lb-podium-medal rank-medal rank-${place}`}>
        {place === 1 ? <Crown size={18} /> : place}
      </span>
      <span className="lb-podium-team">{team.teamName}</span>
      <span className="lb-podium-id">{team.teamId}</span>
      <span className="venue-tag">{team.venue}</span>
      <span className="lb-podium-total">{team.total}</span>
      <span className="lb-podium-sub">points</span>
    </div>
  );
}

function Podium({ teams }: { teams: RankedRow[] }) {
  if (teams.length === 0) return null;
  const [first, second, third] = teams;
  // Visual order: 2nd · 1st · 3rd
  const slots: Array<{ team: RankedRow | undefined; place: 1 | 2 | 3 }> = [
    { team: second, place: 2 },
    { team: first, place: 1 },
    { team: third, place: 3 },
  ];
  return (
    <div className="lb-podium">
      {slots.map(({ team, place }) =>
        team ? <PodiumCard key={team.id} team={team} place={place} /> : <div key={place} />,
      )}
    </div>
  );
}

export default function Leaderboard() {
  const [venue, setVenue] = useState("ALL");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isError, setIsError] = useState(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let alive = true;
    void tickStage();
    const load = async () => {
      try {
        const next = await getLeaderboardData();
        if (!alive) return;
        setData(next);
        setIsError(false);
        loadedOnce.current = true;
      } catch {
        if (alive && !loadedOnce.current) setIsError(true);
      }
    };
    void load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const isLoading = !data && !isError;
  const stage = stageCopy[data?.settings.currentStage ?? "ROUND_1_UPCOMING"];
  const activeGroup = data?.groups.find((group) => String(group.id) === venue);
  const venueOptions = useMemo(
    () =>
      Array.from(new Set((data?.teams ?? []).map((team) => team.venue))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [data?.teams],
  );
  const displayedTeams = useMemo(() => {
    if (!data?.teams) return [];
    if (activeGroup) return data.teams.filter((team) => activeGroup.venues.includes(team.venue));
    if (venue !== "ALL") return data.teams.filter((team) => team.venue === venue);
    return data.teams;
  }, [activeGroup, venue, data?.teams]);
  return (
    <main className="lb-root">
      <div className="event-grid" style={{ minHeight: "100vh" }}>
        <header className="mx-auto flex max-w-[1480px] items-center justify-between px-5 py-6 lg:px-10">
          <a className="brand-link" href="https://gradientclub.in" target="_blank" rel="noopener noreferrer">
            <div className="brand-mark"><img src="/gradient-club-logo.png" alt="Gradient Club" /></div>
            <div>
              <p className="eyebrow" style={{ color: "#67e8f9" }}>GRADIENT CLUB · SPEC HYDERABAD</p>
              <p className="font-display text-sm font-semibold" style={{ letterSpacing: "0.16em", color: "#fff" }}>SPECATHON 2026</p>
            </div>
          </a>
          <div className="flex items-center gap-3 text-xs" style={{ color: "#94a3b8" }}>
            <Link to="/" className="control-link">← Back to site</Link>
          </div>
        </header>

        <section className="mx-auto max-w-[1480px] px-5 pb-8 lg:px-10 lg:pb-12">
          <div className="hero-rule mb-10" />
          <div className="hero-center">
            <div className="mb-6 flex items-center justify-center gap-2" style={{ color: "#67e8f9" }}>
              <Radio size={15} className="live-pulse" /><span className="eyebrow">LIVE EVALUATION &amp; LEADERBOARD</span>
            </div>
            {displayedTeams.length > 0 && (
              <>
                <div className="mb-1 flex items-center justify-center gap-2" style={{ color: "#67e8f9" }}>
                  <Crown size={14} /><span className="eyebrow">Top 3{activeGroup || venue !== "ALL" ? " · filtered" : ""}</span>
                </div>
                <Podium teams={displayedTeams} />
              </>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-5 pb-14 lg:px-10">
          <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className={`status-dot ${stage?.tone ?? "muted"}`} />
                <span className="eyebrow" style={{ color: "#cbd5e1" }}>{stage?.label ?? "Loading event stage"}</span>
              </div>
              <p className="text-sm" style={{ color: "#64748b" }}>{stage?.helper ?? "Connecting to the evaluation database"}</p>
              <Countdown settings={data?.settings} />
            </div>
            <label className="filter-control">
              <span className="eyebrow" style={{ color: "#64748b" }}>Venue view</span>
              <select value={venue} onChange={(event) => setVenue(event.target.value)} aria-label="Filter by venue">
                <option value="ALL">All venues</option>
                {data && data.groups.length > 0 && (
                  <optgroup label="Groups">
                    {data.groups.map((group) => <option key={group.id} value={group.id}>{group.groupName}</option>)}
                  </optgroup>
                )}
                {venueOptions.length > 0 && (
                  <optgroup label="Venues">
                    {venueOptions.map((venueCode) => <option key={venueCode} value={venueCode}>{venueCode}</option>)}
                  </optgroup>
                )}
              </select>
              <ChevronDown size={15} />
            </label>
          </div>

          <div className="leaderboard-shell">
            <div className="table-scroll">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="rank-col">Rank</th><th>Team</th><th>Venue</th>
                    <th className="score-col">Round 1</th><th className="score-col">Round 2</th>
                    <th className="score-col total-col">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="empty-row">Loading live standings…</td></tr>}
                  {isError && <tr><td colSpan={6} className="empty-row" style={{ color: "#fda4af" }}>Unable to connect to the leaderboard database. Retry shortly.</td></tr>}
                  {!isLoading && !isError && displayedTeams.length === 0 && (
                    <tr><td colSpan={6} className="empty-row">
                      <div className="mx-auto max-w-md">
                        <BarChart3 className="mx-auto mb-3" style={{ color: "#67e8f9" }} size={26} />
                        <p className="font-display text-lg" style={{ color: "#fff" }}>No teams imported yet</p>
                        <p className="mt-1 text-sm" style={{ color: "#64748b" }}>The public ranking will appear here once the administrator completes the official Excel import.</p>
                      </div>
                    </td></tr>
                  )}
                  {displayedTeams.map((team) => (
                    <tr key={team.id} className="leaderboard-row">
                      <td className="rank-cell">{team.rank < 4 ? <span className={`rank-medal rank-${team.rank}`}>{team.rank}</span> : <span>{team.rank}</span>}</td>
                      <td><div className="team-name">{team.teamName}</div><div className="team-id">{team.teamId}</div></td>
                      <td><span className="venue-tag">{team.venue}</span></td>
                      <td className="score-cell">{team.round1Score ?? "—"}</td>
                      <td className="score-cell">{team.round2Score ?? "—"}</td>
                      <td className="score-cell total-score">{team.round1Score !== null || team.round2Score !== null ? team.total : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>Global rank numbers are preserved when a venue group is selected.</span>
              <span className="flex items-center gap-2"><span className="status-dot live" />Syncing automatically</span>
            </div>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[1480px] flex-col gap-3 px-5 py-6 text-xs sm:flex-row sm:items-center sm:justify-between lg:px-10" style={{ borderTop: "1px solid rgba(255,255,255,0.1)", color: "#475569" }}>
          <span>SPECATHON 2026 · Official evaluation display</span>
          <span>Built for accuracy, transparency, and live event operations.</span>
        </footer>
      </div>
    </main>
  );
}
