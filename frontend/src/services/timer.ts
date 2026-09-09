import { supabase } from "./supabase";

export type TimerStatus = "draft" | "scheduled" | "running" | "paused" | "completed";

export type TimerConfig = {
  id: number;
  name: string;
  start_at: string;
  end_at: string;
  status: TimerStatus;
  paused_remaining_seconds?: number | null;
  timezone: string;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
};

export type TimerEventType =
  | "milestone"
  | "evaluation"
  | "mentoring"
  | "break"
  | "submission"
  | "general";

export type TimerEvent = {
  id: string;
  timer_id: number;
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location: string;
  type: TimerEventType;
  sort_order: number;
  is_visible: boolean;
  is_completed?: boolean;
  completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  updated_by?: string | null;
};

export type TimerAuditLog = {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, any>;
};

// ── Built-in Fallbacks for Resilient Zero-Crash Execution ───────────────
export const DEFAULT_FALLBACK_CONFIG: TimerConfig = {
  id: 1,
  name: "SPECATHON 2026",
  start_at: "2026-09-11T09:00:00+05:30",
  end_at: "2026-09-12T21:00:00+05:30",
  status: "scheduled",
  paused_remaining_seconds: 129600, // 36 hours default
  timezone: "Asia/Kolkata",
};

export const DEFAULT_FALLBACK_EVENTS: TimerEvent[] = [
  {
    id: "fb-1",
    timer_id: 1,
    title: "Reporting Time",
    description: "Team reporting, badging, and kit collection.",
    start_at: "2026-09-11T08:30:00+05:30",
    end_at: "2026-09-11T09:30:00+05:30",
    location: "Main Auditorium",
    type: "milestone",
    sort_order: 10,
    is_visible: true,
  },
  {
    id: "fb-2",
    timer_id: 1,
    title: "Inaugural",
    description: "Opening keynote, problem statements, and rules briefing.",
    start_at: "2026-09-11T09:30:00+05:30",
    end_at: "2026-09-11T10:30:00+05:30",
    location: "Main Auditorium",
    type: "milestone",
    sort_order: 20,
    is_visible: true,
  },
  {
    id: "fb-3",
    timer_id: 1,
    title: "Commencement of Hackathon",
    description: "Official start of development. Clock is live!",
    start_at: "2026-09-11T10:30:00+05:30",
    end_at: "2026-09-11T11:30:00+05:30",
    location: "Hacking Arena",
    type: "milestone",
    sort_order: 30,
    is_visible: true,
  },
  {
    id: "fb-4",
    timer_id: 1,
    title: "Round 1 Evaluation",
    description: "First evaluation checkpoint: Architecture and ideation check.",
    start_at: "2026-09-11T11:30:00+05:30",
    end_at: "2026-09-11T13:30:00+05:30",
    location: "Evaluation Bays",
    type: "evaluation",
    sort_order: 40,
    is_visible: true,
  },
  {
    id: "fb-5",
    timer_id: 1,
    title: "Lunch",
    description: "Lunch break for all hackathon participants.",
    start_at: "2026-09-11T13:30:00+05:30",
    end_at: "2026-09-11T14:30:00+05:30",
    location: "Dining Hall",
    type: "break",
    sort_order: 50,
    is_visible: true,
  },
  {
    id: "fb-6",
    timer_id: 1,
    title: "Short Break",
    description: "Quick rest, snacks, and networking.",
    start_at: "2026-09-11T17:30:00+05:30",
    end_at: "2026-09-11T18:00:00+05:30",
    location: "Cafeteria",
    type: "break",
    sort_order: 60,
    is_visible: true,
  },
  {
    id: "fb-7",
    timer_id: 1,
    title: "Dinner",
    description: "Dinner served across campus dining halls.",
    start_at: "2026-09-11T20:00:00+05:30",
    end_at: "2026-09-11T21:00:00+05:30",
    location: "Dining Hall",
    type: "break",
    sort_order: 70,
    is_visible: true,
  },
  {
    id: "fb-8",
    timer_id: 1,
    title: "Mentorship / Internal Evaluation",
    description: "Mentors review prototypes and technical architecture.",
    start_at: "2026-09-11T21:30:00+05:30",
    end_at: "2026-09-11T23:30:00+05:30",
    location: "Hacking Arena",
    type: "mentoring",
    sort_order: 80,
    is_visible: true,
  },
  {
    id: "fb-9",
    timer_id: 1,
    title: "Campfire with Jamming session",
    description: "Midnight campfire, acoustic music, and chill session.",
    start_at: "2026-09-12T00:00:00+05:30",
    end_at: "2026-09-12T01:00:00+05:30",
    location: "Open Amphitheatre",
    type: "break",
    sort_order: 90,
    is_visible: true,
  },
  {
    id: "fb-10",
    timer_id: 1,
    title: "Refresh",
    description: "Morning recharge and wash-up time.",
    start_at: "2026-09-12T06:00:00+05:30",
    end_at: "2026-09-12T07:30:00+05:30",
    location: "Campus Hostels",
    type: "break",
    sort_order: 100,
    is_visible: true,
  },
  {
    id: "fb-11",
    timer_id: 1,
    title: "Breakfast",
    description: "Hot breakfast and coffee/tea served.",
    start_at: "2026-09-12T07:30:00+05:30",
    end_at: "2026-09-12T08:30:00+05:30",
    location: "Dining Hall",
    type: "break",
    sort_order: 110,
    is_visible: true,
  },
  {
    id: "fb-12",
    timer_id: 1,
    title: "Round 2 Evaluation",
    description: "Detailed code review and feature completeness check.",
    start_at: "2026-09-12T10:00:00+05:30",
    end_at: "2026-09-12T13:00:00+05:30",
    location: "Evaluation Bays",
    type: "evaluation",
    sort_order: 120,
    is_visible: true,
  },
  {
    id: "fb-13",
    timer_id: 1,
    title: "Lunch",
    description: "Day 2 lunch buffet.",
    start_at: "2026-09-12T13:00:00+05:30",
    end_at: "2026-09-12T14:00:00+05:30",
    location: "Dining Hall",
    type: "break",
    sort_order: 130,
    is_visible: true,
  },
  {
    id: "fb-14",
    timer_id: 1,
    title: "Final Evaluation",
    description: "Grand jury stage presentations and live project testing.",
    start_at: "2026-09-12T14:30:00+05:30",
    end_at: "2026-09-12T16:30:00+05:30",
    location: "Main Stage",
    type: "evaluation",
    sort_order: 140,
    is_visible: true,
  },
  {
    id: "fb-15",
    timer_id: 1,
    title: "Valedictory & Vote of Thanks",
    description: "Awards ceremony, winner declarations, and closing ceremony.",
    start_at: "2026-09-12T16:30:00+05:30",
    end_at: "2026-09-12T17:30:00+05:30",
    location: "Main Auditorium",
    type: "milestone",
    sort_order: 150,
    is_visible: true,
  },
];

function client() {
  if (!supabase) throw new Error("Supabase client not initialized.");
  return supabase;
}

// ── Hybrid Local Storage & Broadcast Synchronization ──────────────────
const STORAGE_CONFIG_KEY = "specathon_timer_config_state";
const STORAGE_EVENTS_KEY = "specathon_timer_events_state";

export function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = err.code || "";
  return (
    code === "PGRST204" ||
    code === "42P01" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

export function notifyTimerBroadcast() {
  if (typeof window !== "undefined") {
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("specathon_timer_channel");
        bc.postMessage({ type: "timer_update", timestamp: Date.now() });
        bc.close();
      }
    } catch {}
  }

  if (supabase) {
    try {
      supabase.channel("hackathon-timer-realtime").send({
        type: "broadcast",
        event: "timer_update",
        payload: { timestamp: Date.now() },
      });
    } catch {}
  }
}

export function getStoredConfig(): TimerConfig {
  if (typeof window === "undefined") return DEFAULT_FALLBACK_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_FALLBACK_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_FALLBACK_CONFIG;
}

export function setStoredConfig(cfg: TimerConfig) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
  notifyTimerBroadcast();
}

export function getStoredEvents(): TimerEvent[] {
  if (typeof window === "undefined") return DEFAULT_FALLBACK_EVENTS;
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_FALLBACK_EVENTS;
}

export function setStoredEvents(events: TimerEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
  } catch {}
  notifyTimerBroadcast();
}

export async function checkDatabaseMigrationStatus(): Promise<{ migrated: boolean; error?: string }> {
  if (!supabase) return { migrated: false, error: "Supabase client not initialized." };
  try {
    const { error } = await client().from("timer_config").select("id").limit(1);
    if (error) {
      return { migrated: false, error: error.message };
    }
    return { migrated: true };
  } catch (err: any) {
    return { migrated: false, error: err?.message || "Connection error" };
  }
}

// ── Read APIs ──────────────────────────────────────────────────────────

export async function fetchTimerConfig(): Promise<TimerConfig> {
  const local = getStoredConfig();
  if (!supabase) return local;
  try {
    const { data, error } = await client()
      .from("timer_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      if (isTableMissingError(error)) {
        console.warn("[timer-service] timer_config table not found in Supabase schema cache. Using resilient local cache.");
      } else {
        console.warn("[timer-service] Error fetching timer_config, using fallback:", error.message);
      }
      return local;
    }
    if (data) {
      const remote = data as TimerConfig;
      setStoredConfig(remote);
      return remote;
    }
    return local;
  } catch (err) {
    console.warn("[timer-service] Exception fetching timer_config:", err);
    return local;
  }
}

export async function fetchTimerEvents(onlyVisible = true): Promise<TimerEvent[]> {
  const local = getStoredEvents();
  if (!supabase) return onlyVisible ? local.filter((e) => e.is_visible) : local;
  try {
    let query = client()
      .from("timer_events")
      .select("*")
      .order("start_at", { ascending: true })
      .order("sort_order", { ascending: true });

    if (onlyVisible) {
      query = query.eq("is_visible", true);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) {
        console.warn("[timer-service] timer_events table not found in schema cache. Using resilient local cache.");
      } else {
        console.warn("[timer-service] Error fetching timer_events, using fallback:", error.message);
      }
      return onlyVisible ? local.filter((e) => e.is_visible) : local;
    }
    if (data && data.length > 0) {
      const remote = data as TimerEvent[];
      setStoredEvents(remote);
      return remote;
    }
    return onlyVisible ? local.filter((e) => e.is_visible) : local;
  } catch (err) {
    console.warn("[timer-service] Exception fetching timer_events:", err);
    return onlyVisible ? local.filter((e) => e.is_visible) : local;
  }
}

/**
 * High-precision server clock calibration:
 * Calls `get_server_time()` RPC, measures round-trip latency,
 * and derives the accurate clock offset in milliseconds.
 * 
 * offset = estimatedServerNow - localTimeNow
 */
export async function fetchServerTimeOffset(): Promise<number> {
  if (!supabase) return 0;
  try {
    const t0 = Date.now();
    const { data, error } = await client().rpc("get_server_time");
    const t1 = Date.now();

    if (error || !data) {
      return 0;
    }

    const latency = (t1 - t0) / 2;
    const serverTimestampMs = new Date(data).getTime() + latency;
    const offset = serverTimestampMs - t1;
    return offset;
  } catch {
    return 0;
  }
}

export async function fetchTimerAuditLogs(limit = 50): Promise<TimerAuditLog[]> {
  if (!supabase) return [];
  try {
    const { data, error } = await client()
      .from("timer_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as TimerAuditLog[];
  } catch (err) {
    console.error("[timer-service] Failed to fetch audit logs:", err);
    return [];
  }
}

// ── Admin Mutation APIs ────────────────────────────────────────────────

async function logAudit(
  actor: string,
  action: string,
  targetType: string,
  targetId: string | null,
  meta: Record<string, any>
) {
  if (!supabase) return;
  try {
    await client().from("timer_audit_log").insert({
      actor: actor || "admin",
      action,
      target_type: targetType,
      target_id: targetId,
      meta,
    });
  } catch (err) {
    console.warn("[timer-service] Non-fatal audit log failure:", err);
  }
}

export async function updateTimerConfig(
  patch: Partial<Omit<TimerConfig, "id" | "created_at">>,
  actor = "admin"
): Promise<TimerConfig> {
  const currentLocal = getStoredConfig();
  const updatedLocal: TimerConfig = {
    ...currentLocal,
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  // Always persist locally first so state changes take effect instantly across all tabs
  setStoredConfig(updatedLocal);

  if (supabase) {
    try {
      const payload = {
        ...patch,
        updated_at: updatedLocal.updated_at,
        updated_by: actor,
      };

      const { data, error } = await client()
        .from("timer_config")
        .update(payload)
        .eq("id", 1)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_config table missing from Supabase schema cache. Applied update locally.");
          await logAudit(actor, "timer_config_update", "timer_config", "1", {
            updates: patch,
            note: "saved_locally_pending_db_migration",
          });
          return updatedLocal;
        }
        throw error;
      }

      const remote = data as TimerConfig;
      setStoredConfig(remote);
      await logAudit(actor, "timer_config_update", "timer_config", "1", {
        updates: patch,
      });
      return remote;
    } catch (err: any) {
      if (isTableMissingError(err)) {
        return updatedLocal;
      }
      throw err;
    }
  }

  return updatedLocal;
}

/**
 * START TIMER:
 * Starts the hackathon countdown.
 * If in 'scheduled' (or paused/completed), sets start_at to NOW, and end_at to NOW + duration (e.g. 36 hours or paused_remaining_seconds).
 * Sets status to 'running' and clears paused_remaining_seconds.
 */
export async function startTimer(
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const now = Date.now();
  const durationSeconds =
    currentConfig.paused_remaining_seconds && currentConfig.paused_remaining_seconds > 0
      ? currentConfig.paused_remaining_seconds
      : 36 * 3600; // 36 hours default = 129,600s

  const startIso = new Date(now).toISOString();
  const endIso = new Date(now + durationSeconds * 1000).toISOString();

  return updateTimerConfig(
    {
      status: "running",
      start_at: startIso,
      end_at: endIso,
      paused_remaining_seconds: null,
    },
    actor
  );
}

/**
 * STOP (PAUSE) TIMER:
 * Pauses the hackathon countdown at the current remaining seconds.
 * Calculates exact remaining seconds from end_at.
 * Sets status to 'paused' and stores paused_remaining_seconds.
 */
export async function pauseTimer(
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const now = Date.now();
  const endMs = new Date(currentConfig.end_at).getTime();
  const remainingSeconds = Math.max(0, Math.floor((endMs - now) / 1000));

  return updateTimerConfig(
    {
      status: "paused",
      paused_remaining_seconds: remainingSeconds,
    },
    actor
  );
}

/**
 * RESUME TIMER:
 * Resumes countdown from the paused state.
 * Uses paused_remaining_seconds to set the new end_at = NOW + paused_remaining_seconds.
 * Sets status to 'running' and clears paused_remaining_seconds.
 */
export async function resumeTimer(
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const now = Date.now();
  const remainingSeconds =
    currentConfig.paused_remaining_seconds && currentConfig.paused_remaining_seconds > 0
      ? currentConfig.paused_remaining_seconds
      : Math.max(0, Math.floor((new Date(currentConfig.end_at).getTime() - now) / 1000));

  const endIso = new Date(now + remainingSeconds * 1000).toISOString();

  return updateTimerConfig(
    {
      status: "running",
      end_at: endIso,
      paused_remaining_seconds: null,
    },
    actor
  );
}

export async function adjustTimerMinutes(
  deltaMinutes: number,
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  if (currentConfig.status === "paused" || currentConfig.status === "scheduled") {
    // In paused or scheduled state: modify paused_remaining_seconds directly
    const currentRemaining =
      currentConfig.paused_remaining_seconds !== undefined &&
      currentConfig.paused_remaining_seconds !== null
        ? currentConfig.paused_remaining_seconds
        : Math.max(
            0,
            Math.floor(
              (new Date(currentConfig.end_at).getTime() -
                new Date(currentConfig.start_at).getTime()) /
                1000
            )
          );

    const newRemaining = Math.max(0, currentRemaining + deltaMinutes * 60);
    const startMs = new Date(currentConfig.start_at).getTime();
    const newEndIso = new Date(startMs + newRemaining * 1000).toISOString();

    return updateTimerConfig(
      {
        paused_remaining_seconds: newRemaining,
        end_at: newEndIso,
      },
      actor
    );
  } else {
    // In running state: adjust end_at directly
    const prevEnd = new Date(currentConfig.end_at).getTime();
    const newEndMs = prevEnd + deltaMinutes * 60 * 1000;
    const newEndIso = new Date(newEndMs).toISOString();

    return updateTimerConfig(
      {
        end_at: newEndIso,
      },
      actor
    );
  }
}

export async function manualEndEvent(
  _currentConfig?: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const nowIso = new Date().toISOString();
  return updateTimerConfig(
    {
      status: "completed",
      end_at: nowIso,
      paused_remaining_seconds: 0,
    },
    actor
  );
}

export async function createTimerEvent(
  newEvent: Omit<TimerEvent, "id" | "timer_id" | "created_at" | "updated_at">,
  actor = "admin"
): Promise<TimerEvent> {
  const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `evt-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const localItem: TimerEvent = {
    ...newEvent,
    id: newId,
    timer_id: 1,
    created_at: nowIso,
    updated_at: nowIso,
    updated_by: actor,
  };

  const currentEvents = getStoredEvents();
  const nextEvents = [...currentEvents, localItem].sort((a, b) => {
    const diff = new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
    return diff !== 0 ? diff : a.sort_order - b.sort_order;
  });
  setStoredEvents(nextEvents);

  if (supabase) {
    try {
      const payload = {
        ...newEvent,
        timer_id: 1,
        updated_by: actor,
      };

      const { data, error } = await client()
        .from("timer_events")
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Created checkpoint locally.");
          return localItem;
        }
        throw error;
      }

      await logAudit(actor, "timer_event_create", "timer_event", data.id, {
        event_title: newEvent.title,
        start_at: newEvent.start_at,
        end_at: newEvent.end_at,
      });

      return data as TimerEvent;
    } catch (err: any) {
      if (isTableMissingError(err)) return localItem;
      throw err;
    }
  }

  return localItem;
}

export async function updateTimerEvent(
  id: string,
  patch: Partial<Omit<TimerEvent, "id" | "timer_id" | "created_at">>,
  actor = "admin"
): Promise<TimerEvent> {
  const nowIso = new Date().toISOString();
  const currentEvents = getStoredEvents();
  const updatedEvents = currentEvents.map((e) =>
    e.id === id ? { ...e, ...patch, updated_at: nowIso, updated_by: actor } : e
  );
  setStoredEvents(updatedEvents);

  const localUpdated = updatedEvents.find((e) => e.id === id);

  if (supabase) {
    try {
      const payload = {
        ...patch,
        updated_at: nowIso,
        updated_by: actor,
      };

      const { data, error } = await client()
        .from("timer_events")
        .update(payload)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Updated checkpoint locally.");
          if (localUpdated) return localUpdated;
        }
        throw error;
      }

      await logAudit(actor, "timer_event_update", "timer_event", id, {
        updates: patch,
      });

      return data as TimerEvent;
    } catch (err: any) {
      if (isTableMissingError(err) && localUpdated) return localUpdated;
      throw err;
    }
  }

  if (!localUpdated) throw new Error("Checkpoint event not found.");
  return localUpdated;
}

export async function deleteTimerEvent(
  id: string,
  eventTitle: string,
  actor = "admin"
): Promise<void> {
  const currentEvents = getStoredEvents();
  const nextEvents = currentEvents.filter((e) => e.id !== id);
  setStoredEvents(nextEvents);

  if (supabase) {
    try {
      const { error } = await client()
        .from("timer_events")
        .delete()
        .eq("id", id);

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Deleted checkpoint locally.");
          return;
        }
        throw error;
      }

      await logAudit(actor, "timer_event_delete", "timer_event", id, {
        deleted_event_title: eventTitle,
      });
    } catch (err: any) {
      if (isTableMissingError(err)) return;
      throw err;
    }
  }
}

export async function completeTimerEvent(
  id: string,
  eventTitle = "",
  actor = "admin"
): Promise<TimerEvent> {
  const nowIso = new Date().toISOString();
  const currentEvents = getStoredEvents();
  const updatedEvents = currentEvents.map((e) =>
    e.id === id ? { ...e, is_completed: true, completed_at: nowIso, updated_at: nowIso, updated_by: actor } : e
  );
  setStoredEvents(updatedEvents);

  const localUpdated = updatedEvents.find((e) => e.id === id) || {
    id,
    timer_id: 1,
    title: eventTitle,
    description: "",
    start_at: nowIso,
    end_at: nowIso,
    location: "",
    type: "milestone" as const,
    sort_order: 0,
    is_visible: true,
    is_completed: true,
    completed_at: nowIso,
  };

  if (supabase) {
    try {
      const { data, error } = await client()
        .from("timer_events")
        .update({
          is_completed: true,
          completed_at: nowIso,
          updated_at: nowIso,
          updated_by: actor,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Completed checkpoint locally.");
          return localUpdated;
        }
        throw error;
      }

      await logAudit(actor, "timer_event_complete", "timer_event", id, {
        event_title: eventTitle,
        completed_at: nowIso,
      });

      return data as TimerEvent;
    } catch (err: any) {
      if (isTableMissingError(err)) return localUpdated;
      throw err;
    }
  }

  return localUpdated;
}

export async function reopenTimerEvent(
  id: string,
  eventTitle = "",
  actor = "admin"
): Promise<TimerEvent> {
  const nowIso = new Date().toISOString();
  const currentEvents = getStoredEvents();
  const updatedEvents = currentEvents.map((e) =>
    e.id === id ? { ...e, is_completed: false, completed_at: null, updated_at: nowIso, updated_by: actor } : e
  );
  setStoredEvents(updatedEvents);

  const localUpdated = updatedEvents.find((e) => e.id === id) || {
    id,
    timer_id: 1,
    title: eventTitle,
    description: "",
    start_at: nowIso,
    end_at: nowIso,
    location: "",
    type: "milestone" as const,
    sort_order: 0,
    is_visible: true,
    is_completed: false,
    completed_at: null,
  };

  if (supabase) {
    try {
      const { data, error } = await client()
        .from("timer_events")
        .update({
          is_completed: false,
          completed_at: null,
          updated_at: nowIso,
          updated_by: actor,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Reopened checkpoint locally.");
          return localUpdated;
        }
        throw error;
      }

      await logAudit(actor, "timer_event_reopen", "timer_event", id, {
        event_title: eventTitle,
        reopened_at: nowIso,
      });

      return data as TimerEvent;
    } catch (err: any) {
      if (isTableMissingError(err)) return localUpdated;
      throw err;
    }
  }

  return localUpdated;
}

export async function extendCheckpointMinutes(
  id: string,
  deltaMinutes: number,
  currentEnd: string,
  eventTitle = "",
  actor = "admin"
): Promise<TimerEvent> {
  const prevEndMs = new Date(currentEnd).getTime();
  const newEndMs = prevEndMs + deltaMinutes * 60 * 1000;
  const newEndIso = new Date(newEndMs).toISOString();
  const nowIso = new Date().toISOString();

  const currentEvents = getStoredEvents();
  const updatedEvents = currentEvents.map((e) =>
    e.id === id ? { ...e, end_at: newEndIso, updated_at: nowIso, updated_by: actor } : e
  );
  setStoredEvents(updatedEvents);

  const localUpdated = updatedEvents.find((e) => e.id === id) || {
    id,
    timer_id: 1,
    title: eventTitle,
    description: "",
    start_at: nowIso,
    end_at: newEndIso,
    location: "",
    type: "milestone" as const,
    sort_order: 0,
    is_visible: true,
  };

  if (supabase) {
    try {
      const { data, error } = await client()
        .from("timer_events")
        .update({
          end_at: newEndIso,
          updated_at: nowIso,
          updated_by: actor,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isTableMissingError(error)) {
          console.warn("[timer-service] timer_events table missing in schema cache. Extended checkpoint locally.");
          return localUpdated;
        }
        throw error;
      }

      await logAudit(actor, "timer_checkpoint_extend", "timer_event", id, {
        event_title: eventTitle,
        delta_minutes: deltaMinutes,
        new_end_at: newEndIso,
      });

      return data as TimerEvent;
    } catch (err: any) {
      if (isTableMissingError(err)) return localUpdated;
      throw err;
    }
  }

  return localUpdated;
}

