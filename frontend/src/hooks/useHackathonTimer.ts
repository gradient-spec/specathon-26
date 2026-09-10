import { useEffect, useState, useCallback, useRef } from "react";
import {
  TimerConfig,
  TimerEvent,
  DEFAULT_FALLBACK_CONFIG,
  DEFAULT_FALLBACK_EVENTS,
  fetchTimerConfig,
  fetchTimerEvents,
  fetchServerTimeOffset,
  completeTimerEvent,
} from "@/services/timer";
import { supabase } from "@/services/supabase";

export type EventTimerState = "SCHEDULED" | "RUNNING" | "PAUSED" | "COMPLETED";

export interface HackathonTimerReturn {
  config: TimerConfig;
  events: TimerEvent[];
  state: EventTimerState;
  hours: string;
  minutes: string;
  seconds: string;
  totalRemainingSeconds: number;
  formattedTime: string;
  progress: number; // 0.0 to 1.0
  progressPercentage: string; // e.g. "58.3%"
  currentEvent: TimerEvent | null;
  nextEvent: TimerEvent | null;
  nextEventCountdown: string | null; // e.g. "01:17:42"
  isCurrentEventOvertime: boolean;
  authoritativeNow: number;
  loading: boolean;
  serverOffsetMs: number;
  timeUntilStartSeconds: number;
  timeUntilStartFormatted: string;
  refresh: () => Promise<void>;
  completeCurrentEvent: (actor?: string) => Promise<void>;
}

function padZero(num: number): string {
  return Math.max(0, Math.floor(num)).toString().padStart(2, "0");
}

function formatDurationHMS(totalSeconds: number): {
  hours: string;
  minutes: string;
  seconds: string;
  formatted: string;
} {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  const hours = padZero(h);
  const minutes = padZero(m);
  const seconds = padZero(s);

  return {
    hours,
    minutes,
    seconds,
    formatted: `${hours} : ${minutes} : ${seconds}`,
  };
}

export function useHackathonTimer(): HackathonTimerReturn {
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_FALLBACK_CONFIG);
  const [events, setEvents] = useState<TimerEvent[]>(DEFAULT_FALLBACK_EVENTS);
  const [loading, setLoading] = useState(true);
  const [serverOffset, setServerOffset] = useState<number>(0);

  // High-frequency tick state
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const offsetRef = useRef(0);
  offsetRef.current = serverOffset;

  // ── 1. Data Fetcher ──────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const [cfg, evts, offset] = await Promise.all([
        fetchTimerConfig(),
        fetchTimerEvents(true),
        fetchServerTimeOffset(),
      ]);

      setConfig(cfg);
      setEvents(evts);
      setServerOffset(offset);
      offsetRef.current = offset;
    } catch (err) {
      console.warn("[useHackathonTimer] Error refreshing timer data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + periodic server time recalibration
  useEffect(() => {
    refresh();

    // Re-calibrate server offset every 60 seconds
    const offsetInterval = window.setInterval(async () => {
      const offset = await fetchServerTimeOffset();
      setServerOffset(offset);
      offsetRef.current = offset;
    }, 60_000);

    return () => window.clearInterval(offsetInterval);
  }, [refresh]);

  // ── 2. Realtime Subscriptions (Postgres + BroadcastChannel + LocalStorage) ──
  useEffect(() => {
    let debounceTimer: number | null = null;
    const triggerDebouncedRefresh = () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        refresh();
      }, 100);
    };

    // Cross-tab BroadcastChannel sync for zero-latency updates
    let bc: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        bc = new BroadcastChannel("specathon_timer_channel");
        bc.onmessage = () => {
          triggerDebouncedRefresh();
        };
      }
    } catch {}

    // Cross-tab localStorage event listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("specathon_timer_")) {
        triggerDebouncedRefresh();
      }
    };
    window.addEventListener("storage", handleStorage);

    // Supabase Realtime channel (Postgres changes + WebSockets broadcast)
    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel("hackathon-timer-realtime", {
          config: { broadcast: { self: false } },
        })
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "timer_config" },
          triggerDebouncedRefresh
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "timer_events" },
          triggerDebouncedRefresh
        )
        .on("broadcast", { event: "timer_update" }, triggerDebouncedRefresh)
        .subscribe();
    }

    return () => {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      if (bc) bc.close();
      window.removeEventListener("storage", handleStorage);
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [refresh]);

  // ── 3. High-precision 1000ms Display Tick ────────────────────────────
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + offsetRef.current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  // ── 4. Authoritative Timestamp Calculations ──────────────────────────
  const authoritativeNow = nowMs;
  const startMs = new Date(config.start_at).getTime();
  const endMs = new Date(config.end_at).getTime();
  const totalDurationMs = Math.max(1000, endMs - startMs);

  let state: EventTimerState = "SCHEDULED";
  let totalRemainingSeconds = 0;
  let progress = 0;

  if (config.status === "completed") {
    state = "COMPLETED";
    totalRemainingSeconds = 0;
    progress = 1;
  } else if (config.status === "paused") {
    state = "PAUSED";
    totalRemainingSeconds =
      config.paused_remaining_seconds !== undefined && config.paused_remaining_seconds !== null
        ? config.paused_remaining_seconds
        : Math.max(0, Math.floor((endMs - authoritativeNow) / 1000));
    progress =
      totalDurationMs > 0
        ? Math.min(1, Math.max(0, 1 - (totalRemainingSeconds * 1000) / totalDurationMs))
        : 0;
  } else if (config.status === "running") {
    if (authoritativeNow >= endMs) {
      state = "COMPLETED";
      totalRemainingSeconds = 0;
      progress = 1;
    } else {
      state = "RUNNING";
      totalRemainingSeconds = Math.max(0, Math.floor((endMs - authoritativeNow) / 1000));
      progress = Math.min(1, Math.max(0, (authoritativeNow - startMs) / totalDurationMs));
    }
  } else {
    // "scheduled" or "draft"
    if (authoritativeNow >= startMs && authoritativeNow < endMs) {
      // Configured start time has arrived! Auto-transition to RUNNING
      state = "RUNNING";
      totalRemainingSeconds = Math.max(0, Math.floor((endMs - authoritativeNow) / 1000));
      progress = Math.min(1, Math.max(0, (authoritativeNow - startMs) / totalDurationMs));
    } else if (authoritativeNow >= endMs) {
      state = "COMPLETED";
      totalRemainingSeconds = 0;
      progress = 1;
    } else {
      // Scheduled in the future (staging phase)
      state = "SCHEDULED";
      // Total remaining is the full hackathon duration (default 36 hours = 129,600s)
      totalRemainingSeconds =
        config.paused_remaining_seconds !== undefined && config.paused_remaining_seconds !== null
          ? config.paused_remaining_seconds
          : Math.max(0, Math.round((endMs - startMs) / 1000)) || 129600;
      progress = 0;
    }
  }

  const timeUntilStartSeconds = Math.max(0, Math.floor((startMs - authoritativeNow) / 1000));
  const { hours: sh, minutes: sm, seconds: ss } = formatDurationHMS(timeUntilStartSeconds);
  const timeUntilStartFormatted = `${sh}:${sm}:${ss}`;

  const { hours, minutes, seconds, formatted: formattedTime } = formatDurationHMS(totalRemainingSeconds);
  const progressPercentage = `${(progress * 100).toFixed(1)}%`;

  // ── 5. Checkpoint Gating & Overtime Derivation ───────────────────────
  const sortedVisibleEvents = [...events]
    .filter((e) => e.is_visible)
    .sort((a, b) => {
      const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
      return diff !== 0 ? diff : a.sort_order - b.sort_order;
    });

  // An event is completed if explicitly marked is_completed or overall event is completed
  const uncompleted = sortedVisibleEvents.filter(
    (e) => !e.is_completed && state !== "COMPLETED"
  );

  let currentEvent: TimerEvent | null = null;
  let nextEvent: TimerEvent | null = null;
  let isCurrentEventOvertime = false;

  if (uncompleted.length > 0) {
    const candidate = uncompleted[0];
    const candStart = new Date(candidate.start_at).getTime();
    const candEnd = new Date(candidate.end_at).getTime();

    if (state === "RUNNING" || state === "PAUSED") {
      currentEvent = candidate;
      // If time has exceeded the designated end_at, hold in overtime until confirmed!
      isCurrentEventOvertime = authoritativeNow >= candEnd;
      nextEvent = uncompleted.length > 1 ? uncompleted[1] : null;
    } else if (authoritativeNow >= candStart) {
      currentEvent = candidate;
      isCurrentEventOvertime = authoritativeNow >= candEnd;
      nextEvent = uncompleted.length > 1 ? uncompleted[1] : null;
    } else {
      // Event has not started yet (staging phase)
      currentEvent = null;
      nextEvent = candidate;
    }
  }

  let nextEventCountdown: string | null = null;
  if (nextEvent) {
    const nextStartMs = new Date(nextEvent.start_at).getTime();
    const diffSec = Math.max(0, Math.floor((nextStartMs - authoritativeNow) / 1000));
    const { hours: nh, minutes: nm, seconds: ns } = formatDurationHMS(diffSec);
    nextEventCountdown = `${nh}:${nm}:${ns}`;
  }

  const completeCurrentEventAction = useCallback(
    async (actor = "admin") => {
      if (!currentEvent) return;
      await completeTimerEvent(currentEvent.id, currentEvent.title, actor);
      await refresh();
    },
    [currentEvent, refresh]
  );

  return {
    config,
    events,
    state,
    hours,
    minutes,
    seconds,
    totalRemainingSeconds,
    formattedTime,
    progress,
    progressPercentage,
    currentEvent,
    nextEvent,
    nextEventCountdown,
    isCurrentEventOvertime,
    authoritativeNow,
    loading,
    serverOffsetMs: serverOffset,
    timeUntilStartSeconds,
    timeUntilStartFormatted,
    refresh,
    completeCurrentEvent: completeCurrentEventAction,
  };
}

