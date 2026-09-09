import { useMemo, useState, useEffect, useRef } from "react";
import { TimerConfig, TimerEvent } from "@/services/timer";
import { Check, MapPin } from "lucide-react";

interface MetroTimelineProps {
  config?: TimerConfig;
  events: TimerEvent[];
  authoritativeNow: number;
  progress: number; // 0.0 to 1.0
  state: "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED";
}

function formatTimeIST(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "--:--";
  }
}

function formatDayLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    return day === 11 ? "DAY 1" : day === 12 ? "DAY 2" : "DAY 1";
  } catch {
    return "DAY 1";
  }
}

export default function MetroTimeline({
  events,
  authoritativeNow,
  progress,
  state,
}: MetroTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(1200);

  // Measure container viewport width dynamically for projector sizing
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setViewportWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Filter visible events and sort deterministically
  const sortedEvents = useMemo(() => {
    return [...events]
      .filter((e) => e.is_visible)
      .sort((a, b) => {
        const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
        return diff !== 0 ? diff : a.sort_order - b.sort_order;
      });
  }, [events]);

  const numStations = Math.max(1, sortedEvents.length);

  // ── EXACT 2 EVENTS SIMULTANEOUSLY VIEWPORT LOGIC ───────────────────
  // STATION_STEP is exactly half of the viewport width so only ~2 events
  // appear across the screen at any time! No crowding or cramming.
  const STATION_STEP = Math.max(480, viewportWidth / 2);
  const START_PADDING = STATION_STEP / 2; // Center the first event in the left half
  const trackUsableWidth = Math.max(1, (numStations - 1) * STATION_STEP);
  const totalTrackWidth = trackUsableWidth + START_PADDING * 2;

  // Track the absolute coordinate along the track for each station
  const stations = useMemo(() => {
    const firstUncompletedIdx = sortedEvents.findIndex(
      (e) => !e.is_completed && state !== "COMPLETED"
    );

    return sortedEvents.map((evt, idx) => {
      const eStart = new Date(evt.start_at).getTime();
      const eEnd = new Date(evt.end_at).getTime();

      const isCompleted = state === "COMPLETED" || !!evt.is_completed;
      const isCurrent =
        !isCompleted &&
        idx === firstUncompletedIdx &&
        (state === "RUNNING" || state === "PAUSED" || authoritativeNow >= eStart);
      const isOvertime = isCurrent && authoritativeNow >= eEnd;
      const isUpcoming = !isCompleted && !isCurrent;

      const stationX = START_PADDING + idx * STATION_STEP;

      return {
        ...evt,
        stationX,
        isCompleted,
        isCurrent,
        isOvertime,
        isUpcoming,
        timeFormatted: formatTimeIST(evt.start_at),
        dayFormatted: formatDayLabel(evt.start_at),
      };
    });
  }, [sortedEvents, state, authoritativeNow, STATION_STEP, START_PADDING]);

  // Clamped progress from 0.0 to 1.0
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // The pointer moves continuously along the track based on authoritative time
  const pointerOnTrackX = START_PADDING + clampedProgress * trackUsableWidth;

  // ── AUTOCENTER CAMERA LOGIC (POINTER LOCKS AT 50% OF SCREEN) ───────
  // When pointer is on the left half of the screen (pointer <= viewportWidth / 2):
  //   Track stays stationary at 0 and pointer approaches center.
  // Once pointer reaches the middle of the screen (viewportWidth / 2):
  //   The pointer stays locked at the exact horizontal center (50vw)!
  //   The track translates in the opposite direction (-translateX).
  // Near the end: track clamps at max scroll so the pointer reaches the final station.
  const screenCenter = viewportWidth / 2;
  let trackOffset = 0;

  if (totalTrackWidth > viewportWidth) {
    const maxScroll = totalTrackWidth - viewportWidth;
    if (pointerOnTrackX <= screenCenter) {
      trackOffset = 0;
    } else if (pointerOnTrackX - screenCenter >= maxScroll) {
      trackOffset = -maxScroll;
    } else {
      trackOffset = -(pointerOnTrackX - screenCenter);
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-[18px] border-[3.5px] border-black bg-white shadow-[6px_6px_0px_0px_#000] p-3 sm:p-3.5 overflow-hidden select-none"
    >
      {/* Neo-brutalist Technical Header Bar */}
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b-2 border-black/15">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#FFE500] border-2 border-black animate-pulse" />
          <h3 className="font-mono text-xs sm:text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
            <span>EVENT TIMELINE</span>
            <span className="text-black/40">/</span>
            <span className="text-[#8B5CF6]">LIVE TRANSIT RAIL</span>
          </h3>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono uppercase font-bold text-black/70">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-black" />
            <span className="hidden sm:inline">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFE500] border-2 border-black" />
            <span className="hidden sm:inline">Active</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-white border-2 border-black" />
            <span className="hidden sm:inline">Upcoming</span>
          </div>
          <div className="px-2 py-0.5 rounded-[6px] bg-black text-[#FFE500] border border-black font-mono text-[10px] font-black">
            {(clampedProgress * 100).toFixed(1)}% TRAJECTORY
          </div>
        </div>
      </div>

      {/* The Moving Track Viewport (No Scrollbar, Track Translates Smoothly) */}
      <div className="relative w-full h-[148px] sm:h-[156px] overflow-hidden">
        <div
          className="absolute top-0 bottom-0 left-0 transition-transform duration-500 ease-out will-change-transform"
          style={{
            width: `${totalTrackWidth}px`,
            transform: `translateX(${trackOffset}px)`,
          }}
        >
          {/* Base Inactive Rail (Positioned at y=94px) */}
          <div className="absolute top-[94px] left-0 right-0 h-3 rounded-full bg-black/15 border-y-2 border-black" />

          {/* Active Completed Rail Track (from Start to Pointer) */}
          <div
            className="absolute top-[94px] left-0 h-3 rounded-full bg-black border-y-2 border-black transition-all duration-500 ease-linear"
            style={{ width: `${pointerOnTrackX}px` }}
          />

          {/* ── STATION NODES ALONG THE RAIL (ALL PLACED ABOVE RAIL, NO CUTOFF) ── */}
          {stations.map((st, idx) => (
            <div
              key={st.id}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${st.stationX}px` }}
            >
              {/* Station Card - Uniform Top Placement */}
              <div
                className={`w-[290px] sm:w-[330px] p-2.5 rounded-[12px] border-2 transition-all text-left ${
                  st.isCurrent
                    ? "bg-[#FFE500] text-black border-black shadow-[4px_4px_0px_0px_#000] ring-2 ring-black"
                    : st.isCompleted
                    ? "bg-[#F4F0E8] text-black border-black/70 shadow-[2px_2px_0px_0px_#000]"
                    : "bg-white text-black/90 border-black/50 shadow-[2px_2px_0px_0px_#000]"
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-1 font-mono text-[10px] font-black">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded-[5px] border border-black ${
                        st.isCurrent
                          ? "bg-black text-[#FFE500]"
                          : st.isCompleted
                          ? "bg-black/10 text-black"
                          : "bg-black/5 text-black"
                      }`}
                    >
                      {st.timeFormatted}
                    </span>
                    <span className="text-[10px] font-bold text-black/60">
                      {st.dayFormatted}
                    </span>
                  </div>

                  {st.isCurrent ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-[5px] text-[9px] font-black uppercase flex items-center gap-1 border border-black ${
                        st.isOvertime
                          ? "bg-[#EF4444] text-white animate-pulse"
                          : "bg-black text-[#FFE500]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          st.isOvertime ? "bg-white" : "bg-[#FFE500]"
                        } animate-ping`}
                      />
                      {st.isOvertime ? "OVERTIME" : "ACTIVE"}
                    </span>
                  ) : st.isCompleted ? (
                    <span className="px-1.5 py-0.5 rounded-[5px] bg-black text-white text-[9px] font-black flex items-center gap-1">
                      <Check size={9} strokeWidth={3.5} />
                      DONE
                    </span>
                  ) : (
                    <span className="text-[9px] text-black/50 font-bold">
                      GATE #{idx + 1}
                    </span>
                  )}
                </div>

                <h4 className="text-xs sm:text-sm font-black leading-tight line-clamp-1 font-sora uppercase text-black">
                  {st.title}
                </h4>

                {st.location && (
                  <p className="text-[9px] font-mono text-black/60 truncate flex items-center gap-1 mt-0.5">
                    <MapPin size={8} />
                    {st.location}
                  </p>
                )}
              </div>

              {/* Connecting Stem from Card to Rail Node */}
              <div
                className={`w-[2.5px] h-3 mx-auto ${
                  st.isCurrent ? "bg-black" : st.isCompleted ? "bg-black" : "bg-black/40"
                }`}
              />

              {/* Station Node on Track */}
              <div className="relative -mt-[1px] flex items-center justify-center">
                {st.isCurrent ? (
                  <div className="relative flex items-center justify-center">
                    <span className="absolute h-6 w-6 rounded-full bg-[#FFE500]/70 animate-ping" />
                    <div className="h-4.5 w-4.5 rounded-full bg-[#FFE500] border-2 border-black shadow-[1px_1px_0px_#000] flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-black" />
                    </div>
                  </div>
                ) : st.isCompleted ? (
                  <div className="h-4 w-4 rounded-full bg-black border-2 border-black flex items-center justify-center text-white shadow-sm">
                    <Check size={9} strokeWidth={3.5} />
                  </div>
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full bg-white border-2 border-black" />
                )}
              </div>
            </div>
          ))}

          {/* ── CONTINUOUS "NOW" POINTER (TARGETING RAIL WITH BOTTOM BADGE) ── */}
          <div
            className="absolute z-20 top-[94px] transition-all duration-500 ease-linear pointer-events-none"
            style={{ left: `${pointerOnTrackX}px` }}
          >
            <div className="relative -translate-x-1/2 flex flex-col items-center">
              {/* Reticle directly on the rail */}
              <div className="relative -top-[7px] flex items-center justify-center">
                <span className="absolute h-7 w-7 rounded-full bg-[#8B5CF6]/40 animate-ping" />
                <div className="h-5 w-5 rounded-full bg-[#8B5CF6] border-2 border-black shadow-[1px_1px_0px_0px_#000] flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-white" />
                </div>
              </div>

              {/* Graphic "▲ NOW" Brutalist Badge sitting cleanly below the rail */}
              <div className="mt-0.5 px-2.5 py-0.5 rounded-[6px] bg-[#8B5CF6] text-white border-2 border-black font-mono text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                ▲ NOW
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
