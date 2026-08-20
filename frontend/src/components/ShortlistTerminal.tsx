import { forwardRef, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowRight,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import {
  checkShortlistStatus,
  type ShortlistedTeam,
} from "@/services/v2";

type Stage =
  | { kind: "idle" }
  | { kind: "connecting"; query: string }
  | { kind: "result"; outcome: Outcome };

type Outcome =
  | { kind: "not_registered" }
  | { kind: "not_shortlisted" }
  | { kind: "shortlisted"; team: ShortlistedTeam };

type LogLine = {
  text: string;
  tone?: "found" | "verified" | "warn" | "muted";
};

export default function ShortlistTerminal({
  onConfirmSeat,
}: {
  onConfirmSeat: (team: ShortlistedTeam) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const schedule = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timers.current.push(id);
  };

  const runCheck = (q: string) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    setLines([]);
    setStage({
      kind: "connecting",
      query: q,
    });

    const push = (line: LogLine) => {
      setLines((prev) => [...prev, line]);
    };

    let t = 0;

    const step = (delay: number, fn: () => void) => {
      t += delay;
      schedule(fn, t);
    };

    step(280, () =>
      push({
        text: "Connecting to SPECATHON verification database…",
      })
    );

    step(360, () =>
      push({
        text: "Connection established.",
        tone: "found",
      })
    );

    step(360, () =>
      push({
        text: `Querying shortlist records for Team ID "${q}"…`,
      })
    );

    step(420, async () => {
      let result;

      try {
        result = await checkShortlistStatus(q);
      } catch {
        push({
          text: "Team record ..................... NOT FOUND",
          tone: "warn",
        });

        step(500, () =>
          setStage({
            kind: "result",
            outcome: {
              kind: "not_registered",
            },
          })
        );

        return;
      }

      if (result.state === "not_registered") {
        push({
          text: "Team record ..................... NOT FOUND",
          tone: "warn",
        });

        step(500, () =>
          setStage({
            kind: "result",
            outcome: {
              kind: "not_registered",
            },
          })
        );

        return;
      }

      push({
        text: "Team record ..................... FOUND",
        tone: "found",
      });

      step(340, () =>
        push({
          text: "Cross-checking shortlist ledger…",
        })
      );

      step(400, () => {
        if (result.state === "not_shortlisted") {
          push({
            text: "Shortlist status ................ NOT SELECTED",
            tone: "warn",
          });

          step(500, () =>
            setStage({
              kind: "result",
              outcome: {
                kind: "not_shortlisted",
              },
            })
          );
        } else {
          push({
            text: "Shortlist status ................ VERIFIED",
            tone: "verified",
          });

          step(500, () =>
            setStage({
              kind: "result",
              outcome: {
                kind: "shortlisted",
                team: result.team,
              },
            })
          );
        }
      });
    });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) return;

    runCheck(query.trim());
  };

  const reset = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    setLines([]);
    setStage({ kind: "idle" });
  };

  return (
    <motion.div
      id="shortlist-search-panel"
      layout
      transition={{
        layout: {
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
      className="relative mx-auto max-w-2xl rounded-[26px] bg-slate-950/40 backdrop-blur-2xl border border-cyan-400/25 shadow-[0_0_40px_-14px_rgba(0,242,254,0.2)] overflow-hidden"
    >
      {/* Faint top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <AnimatePresence initial={false} mode="popLayout">
        {/* =====================================================
            IDLE STATE
        ====================================================== */}
        {stage.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-8 md:p-12"
          >
            <div className="text-center mb-6">
              <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.05] tracking-tightest text-white">
                Made the{" "}
                <span
                  className="text-lumen"
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontWeight: 700,
                    fontStyle: "italic",
                  }}
                >
                  Cut?
                </span>
              </h2>

              <p className="mt-4 text-base text-slate-400 leading-relaxed">
                Check whether your team has been shortlisted for SPECATHON
                2026.
              </p>
            </div>

            <form
              onSubmit={onSubmit}
              className="mt-9 flex flex-col gap-5"
            >
              {/* Team ID Input */}
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter your Team ID"
                  aria-label="Search shortlist by Team ID"
                  className="w-full rounded-xl bg-slate-900/50 border border-cyan-500/20 pl-12 pr-4 py-4 text-base text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(0,242,254,0.1)] transition-all"
                />
              </div>

              {/* Check Shortlist Status */}
              <button
                id="check-shortlist-btn"
                type="submit"
                className="cta-shimmer-cyan w-full rounded-xl py-4 md:py-5 text-base font-bold flex items-center justify-center gap-2 text-slate-950 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 transition-all"
              >
                CHECK SHORTLIST STATUS
                <ArrowRight size={17} />
              </button>

              {/* Search Another Team */}
              <button
                type="button"
                onClick={reset}
                className="mx-auto inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/40 px-4 py-2 text-[11px] font-mono text-slate-400 hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-400 transition-all"
              >
                <RotateCcw size={12} />
                Search another team
              </button>
            </form>
          </motion.div>
        )}

        {/* =====================================================
            CONNECTING STATE
        ====================================================== */}
        {stage.kind === "connecting" && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative px-8 pb-8 pt-5 md:px-10 md:pb-10 md:pt-6"
          >
            {/* Scanline */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 scan-sweep bg-gradient-to-b from-cyan-400/10 via-cyan-400/0 to-transparent" />

            {/* Log lines */}
            <div className="font-mono text-[12.5px] leading-[1.9] min-h-[132px]">
              {lines.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={
                    l.tone === "found"
                      ? "text-cyan-300"
                      : l.tone === "warn"
                        ? "text-amber-300/90"
                        : "text-slate-400"
                  }
                >
                  <span className="text-slate-600 mr-1.5">
                    ›
                  </span>

                  {l.text}

                  {i === lines.length - 1 && (
                    <span className="terminal-cursor ml-0.5 text-cyan-400">
                      ▌
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* =====================================================
            RESULT STATE
        ====================================================== */}
        {stage.kind === "result" && (
          <ResultView
            key="result"
            outcome={stage.outcome}
            onConfirmSeat={onConfirmSeat}
            onReset={reset}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const ResultView = forwardRef<
  HTMLDivElement,
  {
    outcome: Outcome;
    onConfirmSeat: (team: ShortlistedTeam) => void;
    onReset: () => void;
  }
>(function ResultView(
  { outcome, onConfirmSeat, onReset },
  ref
) {
  /* =====================================================
      NOT REGISTERED
  ====================================================== */
  if (outcome.kind === "not_registered") {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.4,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="p-8 md:p-11 text-center"
      >
        <HelpCircle
          size={26}
          className="mx-auto text-slate-500"
        />

        <div className="mt-3 font-display text-lg text-white">
          Enter correct Team ID
        </div>

        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Double-check your Team ID, or reach the support desk at{" "}
          <a
            href="mailto:gradient@stpetershyd.com"
            className="text-cyan-400 hover:underline"
          >
            gradient@stpetershyd.com
          </a>
          .
        </p>

        <button
          onClick={onReset}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/40 px-4 py-2 text-[11px] font-mono text-slate-400 hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-400 transition-all"
        >
          <RotateCcw size={12} />
          Search again
        </button>
      </motion.div>
    );
  }

  /* =====================================================
      NOT SHORTLISTED
  ====================================================== */
  if (outcome.kind === "not_shortlisted") {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: 0.45,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="relative p-8 md:p-11 text-center overflow-hidden"
      >
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400">
            <HelpCircle size={11} />
            Not Selected
          </div>

          <h2
            className="mt-5 font-display font-bold text-3xl md:text-4xl tracking-tight text-white"
            style={{
              textShadow:
                "0 0 34px rgba(251,191,36,0.15)",
            }}
          >
            Better luck
            <br className="md:hidden" />{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, #FBBF24, #F97316)",
              }}
            >
              next time.
            </span>
          </h2>

          <p className="mt-2.5 text-sm text-slate-300">
            Your team was not selected in this round.
          </p>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-400 leading-relaxed">
            Questions? Reach the support desk at{" "}
            <a
              href="mailto:gradient@stpetershyd.com"
              className="text-cyan-400 hover:underline"
            >
              gradient@stpetershyd.com
            </a>
            .
          </div>

          <button
            onClick={onReset}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/40 px-4 py-2 text-[11px] font-mono text-slate-400 hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-400 transition-all"
          >
            <RotateCcw size={12} />
            Search another team
          </button>
        </div>
      </motion.div>
    );
  }

  /* =====================================================
      SHORTLISTED
  ====================================================== */

  const { team } = outcome;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="relative p-8 md:p-11 text-center overflow-hidden"
    >
      {/* Reveal glow */}
      <motion.div
        initial={{
          opacity: 0.5,
          scale: 0.6,
        }}
        animate={{
          opacity: 0,
          scale: 1.8,
        }}
        transition={{
          duration: 1.1,
          ease: "easeOut",
        }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(0,242,254,0.35), transparent 70%)",
        }}
      />

      {/* Contained particles */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;

        return (
          <motion.span
            key={i}
            initial={{
              opacity: 0.9,
              x: 0,
              y: 0,
            }}
            animate={{
              opacity: 0,
              x: Math.cos(angle) * 70,
              y: Math.sin(angle) * 70,
            }}
            transition={{
              duration: 0.8,
              ease: "easeOut",
              delay: 0.05,
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-cyan-300"
          />
        );
      })}

      <div className="relative">
        <h2
          className="mt-5 font-display font-bold text-3xl md:text-4xl tracking-tight text-white"
          style={{
            textShadow:
              "0 0 34px rgba(0,242,254,0.25)",
          }}
        >
          Congratulations,
          <br className="md:hidden" />{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #00F2FE, #10B981)",
            }}
          >
            you're in.
          </span>
        </h2>

        <p className="mt-2.5 text-sm text-slate-300">
          Your team has been officially shortlisted for SPECATHON 2026.
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
          <div className="font-display text-xl tracking-tight text-white">
            {team.team_name}
          </div>

          <div className="mt-0.5 font-mono text-xs text-slate-500">
            {team.team_id}
          </div>
        </div>

        <button
          onClick={() => onConfirmSeat(team)}
          className="cta-shimmer-cyan mt-6 w-full rounded-xl py-4 text-sm font-bold flex items-center justify-center gap-2 text-slate-950 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 transition-all"
        >
          CONFIRM YOUR SEAT — PROCEED TO PAYMENT
          <ArrowRight size={15} />
        </button>

        <button
          onClick={onReset}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/40 px-4 py-2 text-[11px] font-mono text-slate-400 hover:border-cyan-400/50 hover:bg-cyan-400/5 hover:text-cyan-400 transition-all"
        >
          <RotateCcw size={12} />
          Search another team
        </button>
      </div>
    </motion.div>
  );
});