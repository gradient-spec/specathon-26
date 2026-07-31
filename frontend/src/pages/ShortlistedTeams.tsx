import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, AlertCircle, Users, ArrowRight, Trophy } from "lucide-react";
import Reveal from "@/components/Reveal";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { fetchShortlistedTeams, type ShortlistedTeam } from "@/services/v2";

// ── Types ─────────────────────────────────────────────────────────────────────

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok";    teams: ShortlistedTeam[] }
  | { kind: "error"; message: string };

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShortlistedTeams() {
  const navigate                    = useNavigate();
  const [query, setQuery]           = useState("");
  const [state, setState]           = useState<FetchState>({ kind: "idle" });
  const debounceRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef                    = useRef<HTMLInputElement>(null);

  // ── Fetch with debounce ────────────────────────────────────────────────────

  const doFetch = useCallback(async (q: string) => {
    setState({ kind: "loading" });
    try {
      const teams = await fetchShortlistedTeams(q || undefined);
      setState({ kind: "ok", teams });
    } catch (err) {
      setState({
        kind: "error",
        message: "Unable to load shortlisted teams. Please try again.",
      });
      console.error("[ShortlistedTeams] fetch error:", err);
    }
  }, []);

  // Initial load — fetch all teams on mount
  useEffect(() => {
    doFetch("");
  }, [doFetch]);

  // Debounced search — fires 300ms after user stops typing
  const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      doFetch(val);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const loading = state.kind === "loading";
  const teams   = state.kind === "ok" ? state.teams : [];

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 md:px-10 pt-28 pb-20">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <Reveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <Trophy size={11} />
              Shortlisted Teams
            </div>
            <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tightest">
              Are you on the{" "}
              <span className="font-serif italic text-lumen">Shortlist?</span>
            </h1>
            <p className="mt-5 text-muted text-sm md:text-base leading-relaxed max-w-lg mx-auto">
              Search by your Team ID or Team Name to find your team.
              If shortlisted, you can proceed to payment from here.
            </p>
          </div>
        </Reveal>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <Reveal delay={0.08}>
          <div className="relative mb-10 max-w-xl mx-auto">
            <label htmlFor="team-search" className="sr-only">
              Search by Team ID or Team Name
            </label>
            <Search
              size={16}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
            />
            <input
              id="team-search"
              ref={inputRef}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by Team ID or Team Name…"
              value={query}
              onChange={onQueryChange}
              disabled={loading && query === ""}
              className="
                w-full rounded-2xl border border-line bg-panel/40
                pl-11 pr-4 py-3.5 text-sm text-fg placeholder:text-muted
                transition-all duration-300
                hover:border-lumen/40
                focus:border-lumen/70 focus:bg-panel/70
                focus:shadow-[0_0_0_3px_rgba(74,203,235,0.12),0_0_22px_-6px_rgba(74,203,235,0.4)]
                outline-none
                disabled:opacity-60 disabled:cursor-not-allowed
              "
            />
            {loading && (
              <Loader2
                size={14}
                aria-hidden="true"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-lumen animate-spin"
              />
            )}
          </div>
        </Reveal>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* Loading skeleton — only shown on initial load */}
          {state.kind === "loading" && teams.length === 0 && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
              aria-label="Loading teams…"
              aria-busy="true"
            >
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-line bg-panel/30 h-[72px] animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }}
                />
              ))}
            </motion.div>
          )}

          {/* Error state */}
          {state.kind === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
            >
              <div className="h-12 w-12 rounded-2xl border border-ember/30 bg-ember/[0.08] flex items-center justify-center">
                <AlertCircle size={20} className="text-ember" />
              </div>
              <div>
                <p className="text-fg font-medium">{state.message}</p>
                <p className="text-muted text-sm mt-1">
                  Check your connection and try again.
                </p>
              </div>
              <button
                onClick={() => doFetch(query)}
                className="mt-2 px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-fg hover:border-lumen/40 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          )}

          {/* Empty state */}
          {state.kind === "ok" && teams.length === 0 && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-20 text-center"
            >
              <div className="h-12 w-12 rounded-2xl border border-line bg-panel/40 flex items-center justify-center">
                <Users size={20} className="text-muted" />
              </div>
              <div>
                <p className="text-fg font-medium">No shortlisted teams found.</p>
                <p className="text-muted text-sm mt-1 max-w-xs">
                  Please check your Team ID or Team Name and try again.
                </p>
              </div>
              {query && (
                <button
                  onClick={() => { setQuery(""); doFetch(""); }}
                  className="mt-2 px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-fg hover:border-lumen/40 transition-colors"
                >
                  Clear search
                </button>
              )}
            </motion.div>
          )}

          {/* Results table */}
          {state.kind === "ok" && teams.length > 0 && (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Count */}
              <p className="text-xs font-mono text-muted uppercase tracking-[0.24em] mb-4 text-center">
                {teams.length} team{teams.length === 1 ? "" : "s"} found
              </p>

              {/* Desktop table */}
              <div className="hidden md:block rounded-2xl border border-line overflow-hidden">
                <table className="w-full text-sm" role="table" aria-label="Shortlisted teams">
                  <thead>
                    <tr className="border-b border-line bg-panel/60">
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-mono uppercase tracking-[0.24em] text-muted font-medium">
                        Team ID
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-mono uppercase tracking-[0.24em] text-muted font-medium">
                        Team Name
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-left text-[10px] font-mono uppercase tracking-[0.24em] text-muted font-medium">
                        Team Lead
                      </th>
                      <th scope="col" className="px-5 py-3.5 text-right text-[10px] font-mono uppercase tracking-[0.24em] text-muted font-medium">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {teams.map((team, i) => (
                      <motion.tr
                        key={team.team_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(i * 0.03, 0.3) }}
                        className="bg-panel/20 hover:bg-panel/50 transition-colors group"
                      >
                        <td className="px-5 py-4 font-mono text-xs text-lumen tracking-wider">
                          {team.team_id}
                        </td>
                        <td className="px-5 py-4 font-medium text-fg">
                          {team.team_name}
                        </td>
                        <td className="px-5 py-4 text-muted">
                          {team.team_lead_name}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <PayButton
                            teamId={team.team_id}
                            onNavigate={() =>
                              navigate(`/payment?team=${encodeURIComponent(team.team_id)}`)
                            }
                          />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {teams.map((team, i) => (
                  <motion.div
                    key={team.team_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    className="rounded-2xl border border-line bg-panel/30 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="font-mono text-xs text-lumen tracking-wider">
                          {team.team_id}
                        </div>
                        <div className="font-medium text-fg truncate">
                          {team.team_name}
                        </div>
                        <div className="text-xs text-muted">
                          {team.team_lead_name}
                        </div>
                      </div>
                    </div>
                    <PayButton
                      teamId={team.team_id}
                      fullWidth
                      onNavigate={() =>
                        navigate(`/payment?team=${encodeURIComponent(team.team_id)}`)
                      }
                    />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

// ── Pay Button ─────────────────────────────────────────────────────────────────

function PayButton({
  teamId,
  onNavigate,
  fullWidth = false,
}: {
  teamId: string;
  onNavigate: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={`Pay registration fee for ${teamId}`}
      className={`
        inline-flex items-center justify-center gap-2
        px-4 py-2 rounded-xl
        text-xs font-medium
        bg-lumen/10 border border-lumen/30 text-lumen
        hover:bg-lumen/20 hover:border-lumen/60
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lumen/50
        transition-all duration-200
        ${fullWidth ? "w-full" : ""}
      `}
    >
      Pay Registration Fee
      <ArrowRight size={12} />
    </button>
  );
}
