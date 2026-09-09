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

// ── Read APIs ──────────────────────────────────────────────────────────

export async function fetchTimerConfig(): Promise<TimerConfig> {
  if (!supabase) return DEFAULT_FALLBACK_CONFIG;
  try {
    const { data, error } = await client()
      .from("timer_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn("[timer-service] Error fetching timer_config, using fallback:", error.message);
      return DEFAULT_FALLBACK_CONFIG;
    }
    return data ? (data as TimerConfig) : DEFAULT_FALLBACK_CONFIG;
  } catch (err) {
    console.warn("[timer-service] Exception fetching timer_config:", err);
    return DEFAULT_FALLBACK_CONFIG;
  }
}

export async function fetchTimerEvents(onlyVisible = true): Promise<TimerEvent[]> {
  if (!supabase) return DEFAULT_FALLBACK_EVENTS;
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
      console.warn("[timer-service] Error fetching timer_events, using fallback:", error.message);
      return DEFAULT_FALLBACK_EVENTS;
    }
    return data && data.length > 0 ? (data as TimerEvent[]) : DEFAULT_FALLBACK_EVENTS;
  } catch (err) {
    console.warn("[timer-service] Exception fetching timer_events:", err);
    return DEFAULT_FALLBACK_EVENTS;
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
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  const { data, error } = await client()
    .from("timer_config")
    .update(payload)
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_config_update", "timer_config", "1", {
    updates: patch,
  });

  return data as TimerConfig;
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
  const nowIso = new Date(now).toISOString();

  const patch = {
    status: "running" as TimerStatus,
    start_at: startIso,
    end_at: endIso,
    paused_remaining_seconds: null,
    updated_at: nowIso,
    updated_by: actor,
  };

  const { data, error } = await client()
    .from("timer_config")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_start", "timer_config", "1", {
    duration_seconds: durationSeconds,
    start_at: startIso,
    end_at: endIso,
  });

  return data as TimerConfig;
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
  const nowIso = new Date(now).toISOString();

  const patch = {
    status: "paused" as TimerStatus,
    paused_remaining_seconds: remainingSeconds,
    updated_at: nowIso,
    updated_by: actor,
  };

  const { data, error } = await client()
    .from("timer_config")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_pause", "timer_config", "1", {
    paused_remaining_seconds: remainingSeconds,
  });

  return data as TimerConfig;
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
  const nowIso = new Date(now).toISOString();

  const patch = {
    status: "running" as TimerStatus,
    end_at: endIso,
    paused_remaining_seconds: null,
    updated_at: nowIso,
    updated_by: actor,
  };

  const { data, error } = await client()
    .from("timer_config")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_resume", "timer_config", "1", {
    remaining_seconds: remainingSeconds,
    new_end_at: endIso,
  });

  return data as TimerConfig;
}

export async function adjustTimerMinutes(
  deltaMinutes: number,
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const action = deltaMinutes >= 0 ? "timer_extend" : "timer_reduce";
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  let patch: any = {
    updated_at: nowIso,
    updated_by: actor,
  };

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

    patch = {
      ...patch,
      paused_remaining_seconds: newRemaining,
      end_at: newEndIso,
    };
  } else {
    // In running state: adjust end_at directly
    const prevEnd = new Date(currentConfig.end_at).getTime();
    const newEndMs = prevEnd + deltaMinutes * 60 * 1000;
    const newEndIso = new Date(newEndMs).toISOString();

    patch = {
      ...patch,
      end_at: newEndIso,
    };
  }

  const { data, error } = await client()
    .from("timer_config")
    .update(patch)
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, action, "timer_config", "1", {
    delta_minutes: deltaMinutes,
    previous_end_at: currentConfig.end_at,
    new_end_at: patch.end_at,
    new_paused_remaining_seconds: patch.paused_remaining_seconds,
  });

  return data as TimerConfig;
}

export async function manualEndEvent(
  currentConfig: TimerConfig,
  actor = "admin"
): Promise<TimerConfig> {
  const nowIso = new Date().toISOString();

  const { data, error } = await client()
    .from("timer_config")
    .update({
      status: "completed",
      end_at: nowIso,
      paused_remaining_seconds: 0,
      updated_at: nowIso,
      updated_by: actor,
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_end", "timer_config", "1", {
    manual_termination: true,
    previous_status: currentConfig.status,
    previous_end_at: currentConfig.end_at,
    terminated_at: nowIso,
  });

  return data as TimerConfig;
}

export async function createTimerEvent(
  newEvent: Omit<TimerEvent, "id" | "timer_id" | "created_at" | "updated_at">,
  actor = "admin"
): Promise<TimerEvent> {
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

  if (error) throw error;

  await logAudit(actor, "timer_event_create", "timer_event", data.id, {
    event_title: newEvent.title,
    start_at: newEvent.start_at,
    end_at: newEvent.end_at,
  });

  return data as TimerEvent;
}

export async function updateTimerEvent(
  id: string,
  patch: Partial<Omit<TimerEvent, "id" | "timer_id" | "created_at">>,
  actor = "admin"
): Promise<TimerEvent> {
  const payload = {
    ...patch,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  };

  const { data, error } = await client()
    .from("timer_events")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  await logAudit(actor, "timer_event_update", "timer_event", id, {
    updates: patch,
  });

  return data as TimerEvent;
}

export async function deleteTimerEvent(
  id: string,
  eventTitle: string,
  actor = "admin"
): Promise<void> {
  const { error } = await client()
    .from("timer_events")
    .delete()
    .eq("id", id);

  if (error) throw error;

  await logAudit(actor, "timer_event_delete", "timer_event", id, {
    deleted_event_title: eventTitle,
  });
}

export async function completeTimerEvent(
  id: string,
  eventTitle = "",
  actor = "admin"
): Promise<TimerEvent> {
  const nowIso = new Date().toISOString();

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

  if (error) throw error;

  await logAudit(actor, "timer_event_complete", "timer_event", id, {
    event_title: eventTitle,
    completed_at: nowIso,
  });

  return data as TimerEvent;
}

export async function reopenTimerEvent(
  id: string,
  eventTitle = "",
  actor = "admin"
): Promise<TimerEvent> {
  const nowIso = new Date().toISOString();

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

  if (error) throw error;

  await logAudit(actor, "timer_event_reopen", "timer_event", id, {
    event_title: eventTitle,
    reopened_at: nowIso,
  });

  return data as TimerEvent;
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

  if (error) throw error;

  await logAudit(actor, "timer_checkpoint_extend", "timer_event", id, {
    event_title: eventTitle,
    delta_minutes: deltaMinutes,
    new_end_at: newEndIso,
  });

  return data as TimerEvent;
}

