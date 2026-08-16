import { forwardRef, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight, CheckCircle2, HelpCircle, RotateCcw, Circle } from "lucide-react";
import { searchTeam, type MockTeam } from "@/services/mockShortlist";

/* ── Self-contained shortlist verification widget ─────────────────────
   No fixed/fullscreen overlay — lives inline in the page, transparent
   background preserved. Search → live "database check" terminal → outcome,
   all inside one persistent glass shell that resizes smoothly. */

type Stage =
  | { kind: "idle" }
  | { kind: "connecting"; query: string }
  | { kind: "result"; outcome: Outcome };

type Outcome =
  | { kind: "not_found" }
  | { kind: "not_eligible"; team: MockTeam }
  | { kind: "shortlisted"; team: MockTeam };

type LogLine = { text: string; tone?: "found" | "verified" | "warn" | "muted" };

export default function ShortlistTerminal({
  onConfirmSeat,
}: {
  onConfirmSeat: (team: MockTeam) => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<LogLine[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const schedule = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timers.current.push(id);
  };

  const runCheck = (q: string) => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setLines([]);
    setStage({ kind: "connecting", query: q });

    const push = (line: LogLine) => setLines((prev) => [...prev, line]);
    let t = 0;
    const step = (delay: number, fn: () => void) => {
      t += delay;
      schedule(fn, t);
    };

    step(280, () => push({ text: "Connecting to SPECATHON verification database…" }));
    step(360, () => push({ text: "Connection established.", tone: "found" }));
    step(360, () => push({ text: `Querying shortlist records for "${q}"…` }));
    step(420, () => {
      const team = searchTeam(q);
      if (!team) {
        push({ text: "Team record ..................... NOT FOUND", tone: "warn" });
        step(500, () => setStage({ kind: "result", outcome: { kind: "not_found" } }));
        return;
      }
      push({ text: "Team record ..................... FOUND", tone: "found" });
      step(340, () => push({ text: "Cross-checking shortlist ledger…" }));
      step(400, () => {
        if (team.shortlist_status !== "shortlisted") {
          const label = team.shortlist_status === "waitlisted" ? "WAITLISTED" : "NOT SELECTED";
          push({ text: `Shortlist status ................ ${label}`, tone: "warn" });
          step(500, () => setStage({ kind: "result", outcome: { kind: "not_eligible", team } }));
        } else {
          push({ text: "Shortlist status ................ VERIFIED", tone: "verified" });
          step(500, () => setStage({ kind: "result", outcome: { kind: "shortlisted", team } }));
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
      layout
      transition={{ layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
      className="relative mx-auto max-w-[460px] rounded-[22px] bg-slate-950/40 backdrop-blur-2xl border border-cyan-400/25 shadow-[0_0_40px_-14px_rgba(0,242,254,0.2)] overflow-hidden"
    >
      {/* faint top sheen */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <AnimatePresence initial={false} mode="popLayout">
        {stage.kind === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 md:p-8"
          >
            <div className="text-center">
              <h2
                className="font-display font-bold text-3xl md:text-[2.15rem] tracking-tight text-white"
                style={{ textShadow: "0 0 30px rgba(0,242,254,0.2)" }}
              >
                ARE YOU IN?
              </h2>
              <p className="mt-2.5 text-sm text-slate-400 leading-relaxed">
                Check whether your team has been shortlisted for SPECATHON 2026.
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Enter Team ID, Team Lead Name or Registered Email"
                  aria-label="Search shortlist"
                  className="w-full rounded-xl bg-slate-900/50 border border-cyan-500/20 pl-11 pr-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(0,242,254,0.1)] transition-all"
                />
              </div>
              <button
                type="submit"
                className="cta-shimmer-cyan w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 text-slate-950 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 transition-all"
              >
                CHECK SHORTLIST STATUS <ArrowRight size={15} />
              </button>
            </form>

            <p className="mt-3 text-center text-[11px] font-mono text-slate-500">
              Try:{" "}
              <button type="button" onClick={() => { setQuery("alpha@example.com"); runCheck("alpha@example.com"); }} className="text-cyan-400 hover:underline">
                alpha@example.com
              </button>
              {" · "}
              <button type="button" onClick={() => { setQuery("Team Nova"); runCheck("Team Nova"); }} className="text-cyan-400 hover:underline">
                Team Nova
              </button>{" "}
              (paid)
            </p>
          </motion.div>
        )}

        {stage.kind === "connecting" && (
          <motion.div
            key="connecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative p-5 md:p-6"
          >
            {/* subtle vertical scanline, contained to this card */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 scan-sweep bg-gradient-to-b from-cyan-400/10 via-cyan-400/0 to-transparent" />

            {/* terminal chrome */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Circle size={7} className="fill-cyan-400 text-cyan-400 animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300">
                  SPECATHON CORE
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulseGlow" /> Online
              </span>
            </div>
            <div className="h-px bg-slate-800 mb-4" />

            {/* log lines */}
            <div className="font-mono text-[12.5px] leading-[1.9] min-h-[132px]">
              {lines.map((l, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={
                    l.tone === "found" ? "text-cyan-300" :
                    l.tone === "verified" ? "text-emerald-300 font-semibold" :
                    l.tone === "warn" ? "text-amber-300/90" :
                    "text-slate-400"
                  }
                >
                  <span className="text-slate-600 mr-1.5">›</span>
                  {l.text}
                  {i === lines.length - 1 && <span className="terminal-cursor ml-0.5 text-cyan-400">▌</span>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {stage.kind === "result" && (
          <ResultView key="result" outcome={stage.outcome} onConfirmSeat={onConfirmSeat} onReset={reset} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const ResultView = forwardRef<HTMLDivElement, {
  outcome: Outcome;
  onConfirmSeat: (team: MockTeam) => void;
  onReset: () => void;
}>(function ResultView({ outcome, onConfirmSeat, onReset }, ref) {
  if (outcome.kind === "not_found") {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="p-6 md:p-8 text-center"
      >
        <HelpCircle size={26} className="mx-auto text-slate-500" />
        <div className="mt-3 font-display text-lg text-white">No record found</div>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Double-check your spelling, or reach the support desk at{" "}
          <a href="mailto:support@specathon.dev" className="text-cyan-400 hover:underline">support@specathon.dev</a>.
        </p>
        <button onClick={onReset} className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline">
          <RotateCcw size={12} /> Search again
        </button>
      </motion.div>
    );
  }

  if (outcome.kind === "not_eligible") {
    const { team } = outcome;
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="p-6 md:p-8 text-center"
      >
        <HelpCircle size={26} className="mx-auto text-amber-400/80" />
        <div className="mt-3 font-display text-lg text-white">
          {team.team_name} — {team.shortlist_status === "waitlisted" ? "Waitlisted" : "Not selected this round"}
        </div>
        <p className="mt-2 text-sm text-slate-400 leading-relaxed">
          Hang tight — waitlist movement is communicated by email. Questions?{" "}
          <a href="mailto:support@specathon.dev" className="text-cyan-400 hover:underline">support@specathon.dev</a>.
        </p>
        <button onClick={onReset} className="mt-5 inline-flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:underline">
          <RotateCcw size={12} /> Search again
        </button>
      </motion.div>
    );
  }

  // shortlisted
  const { team } = outcome;
  const paid = team.payment_status === "paid";
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative p-6 md:p-8 text-center overflow-hidden"
    >
      {/* one-time soft glow pulse at reveal */}
      <motion.div
        initial={{ opacity: 0.5, scale: 0.6 }}
        animate={{ opacity: 0, scale: 1.8 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(0,242,254,0.35), transparent 70%)" }}
      />
      {/* a few contained particles, minimal */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            initial={{ opacity: 0.9, x: 0, y: 0 }}
            animate={{ opacity: 0, x: Math.cos(angle) * 70, y: Math.sin(angle) * 70 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.05 }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-cyan-300"
          />
        );
      })}

      <div className="relative">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-400">
          <CheckCircle2 size={11} /> Verified
        </div>

        <h2
          className="mt-5 font-display font-bold text-3xl md:text-4xl tracking-tight text-white"
          style={{ textShadow: "0 0 34px rgba(0,242,254,0.25)" }}
        >
          Congratulations,<br className="md:hidden" />{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, #00F2FE, #10B981)" }}
          >
            you're in.
          </span>
        </h2>
        <p className="mt-2.5 text-sm text-slate-300">
          Your team has been officially shortlisted for SPECATHON 2026.
        </p>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-4">
          <div className="font-display text-xl tracking-tight text-white">{team.team_name}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{team.team_id}</div>
        </div>

        <button
          onClick={() => onConfirmSeat(team)}
          className="cta-shimmer-cyan mt-6 w-full rounded-xl py-4 text-sm font-bold flex items-center justify-center gap-2 text-slate-950 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 transition-all"
        >
          {paid ? "VIEW YOUR DIGITAL PASS" : "CONFIRM YOUR SEAT — PROCEED TO PAYMENT"} <ArrowRight size={15} />
        </button>
        <p className="mt-2.5 text-xs text-slate-500">
          {paid ? "Payment already received — your entry pass is ready." : "Complete payment to lock in your team's place."}
        </p>

        <button onClick={onReset} className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 hover:text-cyan-400 transition-colors">
          <RotateCcw size={11} /> Search another team
        </button>
      </div>
    </motion.div>
  );
});
