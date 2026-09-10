import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHackathonTimer } from "@/hooks/useHackathonTimer";
import MetroTimeline from "@/components/timer/MetroTimeline";
import {
  Home,
  MapPin,
  Clock,
} from "lucide-react";

export default function Timer() {
  const {
    config,
    events,
    state,
    hours,
    minutes,
    seconds,
    progress,
    progressPercentage,
    currentEvent,
    nextEvent,
    isCurrentEventOvertime,
    authoritativeNow,
    timeUntilStartSeconds,
    timeUntilStartFormatted,
  } = useHackathonTimer();

  const [clockString, setClockString] = useState("");

  useEffect(() => {
    try {
      const d = new Date(authoritativeNow);
      setClockString(
        d.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: config.timezone || "Asia/Kolkata",
        })
      );
    } catch {
      setClockString("");
    }
  }, [authoritativeNow, config.timezone]);

  return (
    <div className="h-screen w-screen max-h-screen max-w-screen overflow-hidden flex flex-col justify-between bg-[#F4F0E8] text-black font-sans relative p-3 sm:p-4 md:p-5 select-none">
      {/* Neo-brutalist Technical Dot-Grid Canvas Background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(#000000 1.5px, transparent 1.5px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* ── 1. INDUSTRIAL TOP HEADER ───────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between gap-3 pb-2 border-b-2 border-black/20 shrink-0">
        {/* Left Side: Navigation & Event Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="h-8 w-8 rounded-[10px] bg-white border-2 border-black flex items-center justify-center text-black hover:bg-[#FFE500] transition-colors shadow-[2px_2px_0px_0px_#000]"
            title="Return to Main Website"
          >
            <Home size={15} />
          </Link>

          <div className="hidden sm:flex px-2.5 py-1 rounded-[10px] bg-[#8B5CF6] text-white border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
            36-HOUR FLAGSHIP HACKATHON
          </div>
        </div>

        {/* Right Side: Status Indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Authoritative Clock */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-white border-2 border-black font-mono text-xs font-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-black/60 font-bold">IST:</span>
            <span className="text-black tabular-nums">{clockString}</span>
          </div>
        </div>
      </header>

      {/* ── 2. HERO SCOREBOARD (MASSIVE ELECTRIC YELLOW PANEL) ─────── */}
      <section className="relative z-10 my-auto rounded-[24px] border-[3.5px] border-black bg-[#FFE500] text-black p-4 sm:p-5 lg:p-6 shadow-[8px_8px_0px_0px_#000] flex flex-col justify-between shrink min-h-0">
        {/* Top Technical Metadata Strip */}
        <div className="flex items-center justify-between border-b-2 border-black/25 pb-2">
          <div className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-widest text-black">
            <span className="h-2.5 w-2.5 bg-black" />
            <span>
              {state === "SCHEDULED"
                ? timeUntilStartSeconds > 0
                  ? `HACKATHON SCHEDULED // STARTS IN ${timeUntilStartFormatted}`
                  : "HACKATHON COUNTDOWN // READY TO START"
                : state === "PAUSED"
                ? "TIMER STOPPED // PAUSED"
                : state === "COMPLETED"
                ? "EVENT CONCLUDED"
                : "OFFICIAL TIME REMAINING"}
            </span>
          </div>
        </div>

        {/* Central Display: Scoreboard Digits + Live Phase Side-by-Side */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center my-auto py-2 sm:py-3">
          {/* Massive Monospaced Scoreboard Timer (7 cols on large displays) */}
          <div className="lg:col-span-7 flex flex-col items-center lg:items-start select-none">
            <div className="inline-flex items-baseline gap-1 sm:gap-3 md:gap-4 font-mono font-black tracking-tightest tabular-nums leading-none">
              <div className="flex flex-col items-center">
                <span className="text-6xl sm:text-7xl md:text-8xl xl:text-[8.5rem] font-black text-black leading-none drop-shadow-sm">
                  {hours}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black tracking-widest text-black/75 uppercase mt-1">
                  HOURS
                </span>
              </div>

              <span className="text-5xl sm:text-6xl md:text-7xl xl:text-[7.5rem] text-black/40 -translate-y-2 font-mono font-black animate-pulse">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className="text-6xl sm:text-7xl md:text-8xl xl:text-[8.5rem] font-black text-black leading-none drop-shadow-sm">
                  {minutes}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black tracking-widest text-black/75 uppercase mt-1">
                  MINUTES
                </span>
              </div>

              <span className="text-5xl sm:text-6xl md:text-7xl xl:text-[7.5rem] text-black/40 -translate-y-2 font-mono font-black animate-pulse">
                :
              </span>

              <div className="flex flex-col items-center">
                <span className="text-6xl sm:text-7xl md:text-8xl xl:text-[8.5rem] font-black text-black leading-none drop-shadow-sm">
                  {seconds}
                </span>
                <span className="text-[10px] sm:text-xs font-mono font-black tracking-widest text-black/75 uppercase mt-1">
                  SECONDS
                </span>
              </div>
            </div>
          </div>

          {/* Current Live Phase & Checkpoint Box (5 cols on large displays) */}
          <div className="lg:col-span-5 flex flex-col justify-center rounded-[16px] bg-white border-[3px] border-black p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#000]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] font-black uppercase tracking-wider text-black/70 flex items-center gap-1.5">
                <Clock size={12} />
                CURRENT LIVE PHASE
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-[6px] bg-black text-[#FFE500] font-mono text-[10px] font-black uppercase">
                  {progressPercentage} COMPLETE
                </span>
                {isCurrentEventOvertime ? (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#EF4444] text-white font-mono text-[10px] font-black uppercase border border-black animate-pulse flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    OVERTIME
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[6px] bg-[#8B5CF6] text-white font-mono text-[10px] font-black uppercase border border-black">
                    ● LIVE
                  </span>
                )}
              </div>
            </div>

            {/* Event Title - Large enough to read from 20 meters */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight leading-tight line-clamp-2 text-black font-sora">
              {currentEvent ? currentEvent.title : "PRE-EVENT STAGING & ARRIVAL"}
            </h2>

            {/* Time window & Venue location */}
            <div className="flex items-center justify-between text-xs font-mono font-black text-black/80 mt-2 pt-1.5 border-t-2 border-black/10">
              <span>
                {currentEvent
                  ? `${new Date(currentEvent.start_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })} – ${new Date(currentEvent.end_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}`
                  : "08:30 AM – 10:30 AM IST"}
              </span>

              {currentEvent?.location && (
                <span className="flex items-center gap-1 text-black/70">
                  <MapPin size={11} />
                  {currentEvent.location}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Strip: Progress Bar + Next Checkpoint */}
        <div className="pt-2 border-t-2 border-black/20 space-y-2">
          {/* High-Contrast Trajectory Progress Bar */}
          <div className="h-4 w-full rounded-[10px] bg-black border-2 border-black p-0.5 overflow-hidden shadow-sm">
            <div
              className="h-full rounded-[6px] bg-white transition-all duration-500 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
            />
          </div>

          {/* Sub-strip: Next Milestone */}
          <div className="flex items-center justify-between text-xs font-mono font-black uppercase">
            <div className="flex items-center gap-2">
              <span className="text-black/70">NEXT MILESTONE:</span>
              <span className="px-2 py-0.5 rounded bg-black text-[#FFE500] font-black tracking-wide">
                {nextEvent ? nextEvent.title : "ALL CHECKPOINTS CONCLUDED"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. HORIZONTAL MOVING EVENT RAIL TIMELINE ───────────────── */}
      <section className="relative z-10 shrink-0">
        <MetroTimeline
          config={config}
          events={events}
          authoritativeNow={authoritativeNow}
          progress={progress}
          state={state}
        />
      </section>

      {/* ── 4. MINIMAL TECHNICAL FOOTER ────────────────────────────── */}
      <footer className="relative z-20 flex items-center justify-between text-[11px] font-mono text-black/70 pt-3 sm:pt-4 shrink-0">
        <div />

        <div className="flex items-center gap-4">
          <span className="hidden md:inline">
            SPECATHON 2026 · ST. PETER'S ENGINEERING COLLEGE
          </span>
          <Link
            to="/admin/login"
            className="text-black font-black underline underline-offset-2 hover:bg-[#FFE500] px-1 rounded transition-colors"
          >
            STAFF ADMIN
          </Link>
        </div>
      </footer>
    </div>
  );
}
