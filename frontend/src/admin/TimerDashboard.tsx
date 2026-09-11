import { useState, useEffect, useMemo, FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { useHackathonTimer } from "@/hooks/useHackathonTimer";
import {
  TimerEvent,
  TimerEventType,
  TimerAuditLog,
  adjustTimerMinutes,
  cascadeTimerEventsAdjustment,
  setTimerRemainingSeconds,
  restoreOfficialTimerEvents,
  getSynchronizedEvents,
  updateTimerConfig,
  manualEndEvent,
  startTimer,
  pauseTimer,
  resumeTimer,
  resetTimer,
  scheduleTimer,
  createTimerEvent,
  updateTimerEvent,
  deleteTimerEvent,
  fetchTimerAuditLogs,
  completeTimerEvent,
  reopenTimerEvent,
  extendCheckpointMinutes,
  checkDatabaseMigrationStatus,
} from "@/services/timer";
import ConfirmDialog from "./ConfirmDialog";
import {
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  Plus,
  Trash2,
  Edit2,
  Edit3,
  ExternalLink,
  History,
  Calendar,
  Radio,
  CheckCircle2,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export default function TimerDashboard() {
  const { email } = useAuth();
  const {
    config,
    events,
    state,
    hours,
    minutes,
    seconds,
    progressPercentage,
    currentEvent,
    nextEvent,
    isCurrentEventOvertime,
    timeUntilStartSeconds,
    timeUntilStartFormatted,
    refresh,
  } = useHackathonTimer();

  const [auditLogs, setAuditLogs] = useState<TimerAuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);

  // Time adjustment loading states
  const [busy, setBusy] = useState(false);

  // Reset Timer Confirmation
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // End Event Confirmation
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);

  // Event modal state
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimerEvent | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form states for Event create/edit
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<TimerEventType>("milestone");
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formSort, setFormSort] = useState(0);
  const [formVisible, setFormVisible] = useState(true);

  // Custom End Time date-picker state
  const [customEndLocal, setCustomEndLocal] = useState("");

  // Schedule Start Time date-picker & duration state
  const [scheduleStartLocal, setScheduleStartLocal] = useState("");
  const [scheduleDurationHours, setScheduleDurationHours] = useState(36);

  // Database migration status check
  const [dbMigrated, setDbMigrated] = useState<boolean | null>(null);

  useEffect(() => {
    checkDatabaseMigrationStatus().then((res) => {
      setDbMigrated(res.migrated);
    });
  }, []);

  useEffect(() => {
    if (config.end_at) {
      try {
        const d = new Date(config.end_at);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        setCustomEndLocal(localISOTime);
      } catch {
        // ignore
      }
    }
  }, [config.end_at]);

  useEffect(() => {
    if (config.start_at) {
      try {
        const d = new Date(config.start_at);
        const tzOffset = d.getTimezoneOffset() * 60000;
        const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
        setScheduleStartLocal(localISOTime);
      } catch {
        // ignore
      }
    }
  }, [config.start_at]);

  // Direct editable remaining countdown states
  const [editHours, setEditHours] = useState("36");
  const [editMinutes, setEditMinutes] = useState("00");
  const [editSeconds, setEditSeconds] = useState("00");
  const [isEditingCountdown, setIsEditingCountdown] = useState(false);

  // Synchronized events with canonical fallback durations and dynamic schedule shifts
  const synchronizedEvents = useMemo(() => getSynchronizedEvents(events), [events]);

  // Confirmation dialog states for restoring checkpoints
  const [confirmRestoreCheckpointsOpen, setConfirmRestoreCheckpointsOpen] = useState(false);
  const [confirmRealignCheckpointsOpen, setConfirmRealignCheckpointsOpen] = useState(false);

  useEffect(() => {
    if (!isEditingCountdown) {
      if (hours !== undefined) setEditHours(hours);
      if (minutes !== undefined) setEditMinutes(minutes);
      if (seconds !== undefined) setEditSeconds(seconds);
    }
  }, [hours, minutes, seconds, isEditingCountdown]);

  const calculatedEndTimePreview = (() => {
    if (!scheduleStartLocal) return "";
    const startMs = new Date(scheduleStartLocal).getTime();
    if (Number.isNaN(startMs)) return "";
    const endMs = startMs + scheduleDurationHours * 3600 * 1000;
    return new Date(endMs).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  })();

  const loadAudit = async () => {
    setLoadingAudit(true);
    try {
      const logs = await fetchTimerAuditLogs(50);
      setAuditLogs(logs);
    } catch {
      toast.error("Failed to load audit logs.");
    } finally {
      setLoadingAudit(false);
    }
  };

  // Direct Editable Remaining Countdown Handler
  const handleApplyExactRemaining = async (customTotalSec?: number) => {
    if (busy) return;
    let targetSeconds = customTotalSec;
    if (targetSeconds === undefined) {
      const h = parseInt(editHours || "0", 10);
      const m = parseInt(editMinutes || "0", 10);
      const s = parseInt(editSeconds || "0", 10);
      if (
        isNaN(h) ||
        isNaN(m) ||
        isNaN(s) ||
        h < 0 ||
        m < 0 ||
        m > 59 ||
        s < 0 ||
        s > 59
      ) {
        toast.error("Please enter a valid time (Hours >= 0, Minutes 0-59, Seconds 0-59).");
        return;
      }
      targetSeconds = h * 3600 + m * 60 + s;
    }

    if (targetSeconds < 0) {
      toast.error("Remaining time cannot be negative.");
      return;
    }

    setBusy(true);
    try {
      await setTimerRemainingSeconds(targetSeconds, config, email || "admin");
      const hStr = Math.floor(targetSeconds / 3600).toString().padStart(2, "0");
      const mStr = Math.floor((targetSeconds % 3600) / 60).toString().padStart(2, "0");
      const sStr = Math.floor(targetSeconds % 60).toString().padStart(2, "0");
      toast.success(`Timer countdown set to ${hStr}:${mStr}:${sStr}! Timeline synchronized.`);
      setIsEditingCountdown(false);
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to set timer.");
    } finally {
      setBusy(false);
    }
  };

  // Apply Quick Preset to Timer Countdown
  const applyPreset = (h: number, m = 0, s = 0) => {
    const hStr = h.toString().padStart(2, "0");
    const mStr = m.toString().padStart(2, "0");
    const sStr = s.toString().padStart(2, "0");
    setEditHours(hStr);
    setEditMinutes(mStr);
    setEditSeconds(sStr);
    setIsEditingCountdown(true);
    handleApplyExactRemaining(h * 3600 + m * 60 + s);
  };

  // Restore Official Checkpoint Timings with canonical durations
  const handleRestoreOfficialCheckpoints = async (reanchorToTimerStart: boolean) => {
    setConfirmRestoreCheckpointsOpen(false);
    setConfirmRealignCheckpointsOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const anchor = reanchorToTimerStart && config.start_at ? config.start_at : undefined;
      await restoreOfficialTimerEvents(anchor, email || "admin");
      toast.success(
        reanchorToTimerStart
          ? "Restored official checkpoints and aligned them with current timer launch time!"
          : "Restored official checkpoints schedule with canonical event durations!"
      );
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore official checkpoints.");
    } finally {
      setBusy(false);
    }
  };

  // Quick Delta Adjustment
  const handleQuickDelta = async (deltaMinutes: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await adjustTimerMinutes(deltaMinutes, config, email || "admin");
      toast.success(
        `Timer adjusted by ${deltaMinutes >= 0 ? `+${deltaMinutes}` : deltaMinutes} minutes.`
      );
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust timer.");
    } finally {
      setBusy(false);
    }
  };

  // Custom End Time Update
  const handleApplyCustomEndTime = async () => {
    if (!customEndLocal) return;
    setBusy(true);
    try {
      const newEndMs = new Date(customEndLocal).getTime();
      const prevEndMs = new Date(config.end_at).getTime();
      const deltaMinutes = Math.round((newEndMs - prevEndMs) / 60000);
      if (deltaMinutes !== 0 && (state === "RUNNING" || state === "PAUSED")) {
        await cascadeTimerEventsAdjustment(deltaMinutes, email || "admin");
      }
      const newEndIso = new Date(customEndLocal).toISOString();
      await updateTimerConfig({ end_at: newEndIso }, email || "admin");
      toast.success("Updated event end time and aligned timeline successfully.");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to set custom end time.");
    } finally {
      setBusy(false);
    }
  };

  // Manual End Event
  const handleEndEventConfirm = async () => {
    setConfirmEndOpen(false);
    setBusy(true);
    try {
      await manualEndEvent(config, email || "admin");
      toast.success("Event ended. Timer set to 00:00:00.");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to end event.");
    } finally {
      setBusy(false);
    }
  };

  // Start Hackathon Timer (starts 36h countdown)
  const handleStartTimer = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await startTimer(config, email || "admin");
      toast.success("Hackathon timer started! Clock is running.");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to start timer.");
    } finally {
      setBusy(false);
    }
  };

  // Stop (Pause) Timer
  const handleStopTimer = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await pauseTimer(config, email || "admin");
      toast.success("Hackathon timer stopped (paused).");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to stop timer.");
    } finally {
      setBusy(false);
    }
  };

  // Resume Timer
  const handleResumeTimer = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await resumeTimer(config, email || "admin");
      toast.success("Hackathon timer resumed!");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to resume timer.");
    } finally {
      setBusy(false);
    }
  };

  // Reset Timer Confirm (sets to 36h Scheduled)
  const handleResetTimerConfirm = async () => {
    setConfirmResetOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      await resetTimer(
        {
          durationHours: 36,
          resetCheckpoints: true,
        },
        email || "admin"
      );
      toast.success("Timer reset successfully to 36:00:00 (Scheduled state).");
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset timer.");
    } finally {
      setBusy(false);
    }
  };

  // Schedule Timer to start at configured time
  const handleApplySchedule = async () => {
    if (!scheduleStartLocal) {
      toast.error("Please pick a valid start date and time.");
      return;
    }
    const startMs = new Date(scheduleStartLocal).getTime();
    if (Number.isNaN(startMs)) {
      toast.error("Invalid start date and time selected.");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await scheduleTimer(new Date(startMs), scheduleDurationHours, email || "admin");
      toast.success(
        `Timer scheduled to start on ${new Date(startMs).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })} for ${scheduleDurationHours} hours!`
      );
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule timer.");
    } finally {
      setBusy(false);
    }
  };

  // Checkpoint manual completion (advances to next checkpoint)
  const handleCompleteCheckpoint = async (eventId: string, eventTitle = "") => {
    setBusy(true);
    try {
      await completeTimerEvent(eventId, eventTitle, email || "admin");
      toast.success(`Completed "${eventTitle || "Checkpoint"}". Advanced to next phase.`);
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  // Reopen checkpoint
  const handleReopenCheckpoint = async (eventId: string, eventTitle = "") => {
    setBusy(true);
    try {
      await reopenTimerEvent(eventId, eventTitle, email || "admin");
      toast.success(`Reopened "${eventTitle || "Checkpoint"}".`);
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  // Extend checkpoint by delta minutes
  const handleExtendCheckpoint = async (
    eventId: string,
    deltaMinutes: number,
    currentEnd: string,
    eventTitle = ""
  ) => {
    setBusy(true);
    try {
      await extendCheckpointMinutes(
        eventId,
        deltaMinutes,
        currentEnd,
        eventTitle,
        email || "admin"
      );
      toast.success(
        `Added +${deltaMinutes}m to "${eventTitle || "Checkpoint"}".`
      );
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to extend checkpoint.");
    } finally {
      setBusy(false);
    }
  };


  // Open Event Modal
  const openCreateModal = () => {
    setEditingEvent(null);
    setFormTitle("");
    setFormDesc("");
    setFormType("milestone");
    setFormLocation("");
    setFormSort((events.length + 1) * 10);
    setFormVisible(true);

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const sTime = new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
    const eTime = new Date(now.getTime() + 60 * 60 * 1000 - tzOffset).toISOString().slice(0, 16);
    setFormStart(sTime);
    setFormEnd(eTime);

    setEventModalOpen(true);
  };

  const openEditModal = (evt: TimerEvent) => {
    setEditingEvent(evt);
    setFormTitle(evt.title);
    setFormDesc(evt.description || "");
    setFormType(evt.type);
    setFormLocation(evt.location || "");
    setFormSort(evt.sort_order);
    setFormVisible(evt.is_visible);

    const s = new Date(evt.start_at);
    const e = new Date(evt.end_at);
    const tzOffset = s.getTimezoneOffset() * 60000;
    setFormStart(new Date(s.getTime() - tzOffset).toISOString().slice(0, 16));
    setFormEnd(new Date(e.getTime() - tzOffset).toISOString().slice(0, 16));

    setEventModalOpen(true);
  };

  // Save Event (Create or Update)
  const handleSaveEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStart || !formEnd) {
      toast.error("Please fill in title, start time, and end time.");
      return;
    }

    setBusy(true);
    try {
      const startIso = new Date(formStart).toISOString();
      const endIso = new Date(formEnd).toISOString();

      if (editingEvent) {
        await updateTimerEvent(
          editingEvent.id,
          {
            title: formTitle.trim(),
            description: formDesc.trim(),
            type: formType,
            start_at: startIso,
            end_at: endIso,
            location: formLocation.trim(),
            sort_order: Number(formSort),
            is_visible: formVisible,
          },
          email || "admin"
        );
        toast.success(`Updated checkpoint "${formTitle}".`);
      } else {
        await createTimerEvent(
          {
            title: formTitle.trim(),
            description: formDesc.trim(),
            type: formType,
            start_at: startIso,
            end_at: endIso,
            location: formLocation.trim(),
            sort_order: Number(formSort),
            is_visible: formVisible,
          },
          email || "admin"
        );
        toast.success(`Created checkpoint "${formTitle}".`);
      }

      setEventModalOpen(false);
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to save event checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async () => {
    if (!deleteConfirmId) return;
    const target = events.find((e) => e.id === deleteConfirmId);
    setBusy(true);
    try {
      await deleteTimerEvent(deleteConfirmId, target?.title || "Unknown", email || "admin");
      toast.success("Checkpoint deleted.");
      setDeleteConfirmId(null);
      await refresh();
      loadAudit();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete checkpoint.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── 1. LIVE STATUS BANNER ───────────────────────────────────── */}
      <div className="rounded-2xl border-2 border-line/80 bg-ink/70 p-6 backdrop-blur-md shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-cyan-400">
              Live Event Command
            </span>
            <span className="text-muted">·</span>
            <span className="font-mono text-xs text-subtle">{config.timezone}</span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2 className="font-sora text-2xl sm:text-3xl font-extrabold tracking-tight text-fg">
              {config.name}
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full font-mono text-xs font-extrabold uppercase ${
                state === "RUNNING"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : state === "PAUSED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : state === "SCHEDULED"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "bg-violet-500/20 text-violet-300 border border-violet-500/40"
              }`}
            >
              {state}
            </span>
          </div>
        </div>

        {/* Live Remaining Clock & Action */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group px-5 py-3 rounded-xl bg-void border border-line font-mono text-center min-w-[170px]">
            <div className="text-[10px] uppercase tracking-widest text-subtle flex items-center justify-center gap-1.5">
              <span>
                {state === "SCHEDULED"
                  ? "Clock Ready"
                  : state === "PAUSED"
                  ? "Timer Paused"
                  : state === "COMPLETED"
                  ? "Concluded"
                  : "Remaining"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsEditingCountdown(true);
                  const el = document.getElementById("direct-timer-editor");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-subtle hover:text-yellow-400 transition-colors p-0.5"
                title="Edit remaining countdown directly"
              >
                <Edit3 size={11} />
              </button>
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              {hours}:{minutes}:{seconds}
            </div>
          </div>

          <a
            href="/timer"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-plasma/20 border border-plasma/40 text-cyan-300 hover:bg-plasma/30 hover:border-cyan-400 transition-all text-xs font-semibold"
          >
            <ExternalLink size={14} />
            Open Public /timer Screen
          </a>

          <button
            onClick={() => {
              loadAudit();
              setShowAuditModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl border border-line bg-panel/40 text-xs text-subtle hover:text-fg hover:border-subtle transition-all"
            title="View Audit Log"
          >
            <History size={14} />
            Audit
          </button>
        </div>
      </div>

      {/* ── NOTICE: Database Migration Status Alert ─────────────────── */}
      {dbMigrated === false && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 flex items-start gap-3 text-xs font-mono text-amber-300 shadow-sm">
          <AlertCircle className="shrink-0 text-amber-400 mt-0.5" size={18} />
          <div className="space-y-1">
            <div className="font-bold text-amber-200 uppercase tracking-wide">
              Notice: Table &apos;public.timer_config&apos; not found in Supabase schema cache
            </div>
            <p className="text-amber-300/80 leading-relaxed">
              The timer is running in resilient local/cross-tab mode and functions immediately. To sync timer state and checkpoints across all devices in the cloud, run the migration script in <span className="text-amber-100 font-bold underline">supabase/migrations/0022_hackathon_timer.sql</span> in your <strong>Supabase Dashboard &rarr; SQL Editor</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── 2. MASTER COMMAND CONTROLS (START / STOP / RESUME / END) ── */}
      <div className="rounded-2xl border-2 border-line/80 bg-ink/70 p-6 backdrop-blur-md shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/40 pb-3">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-cyan-400 animate-pulse" />
            <h3 className="font-sora text-sm font-bold uppercase tracking-wider text-fg">
              Master Event Timer Controls
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-subtle">Timer State:</span>
            <span
              className={`px-2 py-0.5 rounded font-extrabold uppercase ${
                state === "RUNNING"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : state === "PAUSED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : state === "SCHEDULED"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                  : "bg-red-500/20 text-red-400 border border-red-500/40"
              }`}
            >
              {state}
            </span>
          </div>
        </div>

        {/* 5 Dedicated Command Buttons: START, STOP, RESUME, RESET, END */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* START BUTTON */}
          <button
            onClick={handleStartTimer}
            disabled={busy || state === "RUNNING"}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-emerald-500/80 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-mono font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Play size={18} fill="currentColor" />
              <span className="text-base tracking-wide">START</span>
            </div>
            <span className="text-[10px] font-normal text-emerald-400/80">
              {state === "RUNNING" ? "Running" : "Launch Countdown"}
            </span>
          </button>

          {/* STOP (PAUSE) BUTTON */}
          <button
            onClick={handleStopTimer}
            disabled={busy || state !== "RUNNING"}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-amber-500/80 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Pause size={18} fill="currentColor" />
              <span className="text-base tracking-wide">STOP</span>
            </div>
            <span className="text-[10px] font-normal text-amber-400/80">
              {state === "PAUSED" ? "Paused (Stopped)" : "Halt / Freeze Clock"}
            </span>
          </button>

          {/* RESUME BUTTON */}
          <button
            onClick={handleResumeTimer}
            disabled={busy || state !== "PAUSED"}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-cyan-500/80 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Play size={18} />
              <span className="text-base tracking-wide">RESUME</span>
            </div>
            <span className="text-[10px] font-normal text-cyan-400/80">
              {state === "RUNNING" ? "Running" : "Unfreeze Countdown"}
            </span>
          </button>

          {/* RESET BUTTON */}
          <button
            onClick={() => setConfirmResetOpen(true)}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-indigo-500/80 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-mono font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <RotateCcw size={18} />
              <span className="text-base tracking-wide">RESET</span>
            </div>
            <span className="text-[10px] font-normal text-indigo-400/80">
              Reset to 36:00:00
            </span>
          </button>

          {/* END BUTTON */}
          <button
            onClick={() => setConfirmEndOpen(true)}
            disabled={busy || state === "COMPLETED"}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-red-500/80 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-mono font-black text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-center gap-2">
              <Square size={18} fill="currentColor" />
              <span className="text-base tracking-wide">END</span>
            </div>
            <span className="text-[10px] font-normal text-red-400/80">
              {state === "COMPLETED" ? "Concluded" : "Finish Event (00:00:00)"}
            </span>
          </button>
        </div>
      </div>

      {/* ── 3. LIVE TIME MANIPULATION & STAGING ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Add / Deduct Time Card */}
        <div className="lg:col-span-2 rounded-2xl border-2 border-line/80 bg-ink/50 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-line/40 pb-3">
            <h3 className="font-sora text-sm font-bold uppercase tracking-wider text-fg flex items-center gap-2">
              <Clock size={16} className="text-cyan-400" />
              Live Time Extension / Reduction
            </h3>
          </div>

          {/* Direct Editable Remaining Countdown Widget */}
          <div id="direct-timer-editor" className="p-4 rounded-xl bg-void border-2 border-yellow-500/50 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line/40 pb-2.5">
              <div className="flex items-center gap-2">
                <Edit3 size={15} className="text-yellow-400" />
                <span className="eyebrow !text-[11px] text-yellow-400 font-bold uppercase tracking-wider">
                  Set Exact Remaining Countdown (Editable HH:MM:SS)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isEditingCountdown && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCountdown(false);
                      setEditHours(hours);
                      setEditMinutes(minutes);
                      setEditSeconds(seconds);
                    }}
                    className="text-[10px] font-mono text-subtle hover:text-yellow-400 underline"
                  >
                    Sync with Current Clock
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Numeric Input Fields */}
              <div className="flex items-center gap-1.5 font-mono">
                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={editHours}
                    onFocus={() => setIsEditingCountdown(true)}
                    onChange={(e) => {
                      setIsEditingCountdown(true);
                      setEditHours(e.target.value);
                    }}
                    className="w-16 sm:w-20 text-center py-2 px-1 text-xl sm:text-2xl font-black rounded-lg bg-panel border-2 border-line focus:border-yellow-400 text-yellow-400 focus:outline-none"
                    placeholder="36"
                  />
                  <span className="text-[9px] text-subtle uppercase mt-0.5">Hours</span>
                </div>

                <span className="text-xl sm:text-2xl font-black text-subtle pb-4">:</span>

                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editMinutes}
                    onFocus={() => setIsEditingCountdown(true)}
                    onChange={(e) => {
                      setIsEditingCountdown(true);
                      setEditMinutes(e.target.value);
                    }}
                    className="w-16 sm:w-20 text-center py-2 px-1 text-xl sm:text-2xl font-black rounded-lg bg-panel border-2 border-line focus:border-yellow-400 text-yellow-400 focus:outline-none"
                    placeholder="00"
                  />
                  <span className="text-[9px] text-subtle uppercase mt-0.5">Mins</span>
                </div>

                <span className="text-xl sm:text-2xl font-black text-subtle pb-4">:</span>

                <div className="flex flex-col items-center">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editSeconds}
                    onFocus={() => setIsEditingCountdown(true)}
                    onChange={(e) => {
                      setIsEditingCountdown(true);
                      setEditSeconds(e.target.value);
                    }}
                    className="w-16 sm:w-20 text-center py-2 px-1 text-xl sm:text-2xl font-black rounded-lg bg-panel border-2 border-line focus:border-yellow-400 text-yellow-400 focus:outline-none"
                    placeholder="00"
                  />
                  <span className="text-[9px] text-subtle uppercase mt-0.5">Secs</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleApplyExactRemaining()}
                disabled={busy}
                className="px-5 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-mono font-black text-xs uppercase transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                <Check size={16} strokeWidth={3} />
                <span>Apply Timer Countdown</span>
              </button>
            </div>

            {/* Quick Preset Buttons (e.g. 36h, 32h, 28h, 24h, 18h, 12h, 6h, 1h) */}
            <div className="pt-2 border-t border-line/30 flex flex-wrap items-center gap-1.5 font-mono text-xs">
              <span className="eyebrow !text-[10px] text-subtle mr-1">Quick Presets:</span>
              {[36, 32, 28, 24, 18, 12, 6, 1].map((hrs) => (
                <button
                  key={`preset-${hrs}`}
                  type="button"
                  onClick={() => applyPreset(hrs)}
                  disabled={busy}
                  className="px-2.5 py-1 rounded-lg border border-yellow-500/30 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 text-xs font-bold transition-all disabled:opacity-50"
                  title={`Set remaining time directly to ${hrs}:00:00`}
                >
                  {hrs.toString().padStart(2, "0")}:00:00
                </button>
              ))}
            </div>
          </div>

          {/* Quick Adjustment Buttons */}
          <div className="space-y-4">
            {/* Primary Repeatable +/- 5 Min Buttons */}
            <div>
              <div className="eyebrow !text-[11px] mb-2 text-emerald-400 font-bold">
                Quick Adjustments (Tap repeatedly to add/deduct multiple times)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  key="hero-plus-5"
                  onClick={() => handleQuickDelta(5)}
                  disabled={busy}
                  className="py-3.5 px-4 rounded-xl border-2 border-emerald-500 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-mono font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus size={16} />
                  <span>+5 MIN</span>
                </button>

                <button
                  key="hero-minus-5"
                  onClick={() => handleQuickDelta(-5)}
                  disabled={busy}
                  className="py-3.5 px-4 rounded-xl border-2 border-amber-500 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-mono font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>-5 MIN</span>
                </button>
              </div>
            </div>

            {/* Other Increments */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-line/30 text-xs font-mono">
              <span className="eyebrow !text-[10px] text-subtle mr-2">Other deltas:</span>
              {[1, 10, 30].map((m) => (
                <button
                  key={`plus-${m}`}
                  onClick={() => handleQuickDelta(m)}
                  disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-500/20 text-emerald-400 text-xs transition-all disabled:opacity-50"
                >
                  +{m}m
                </button>
              ))}
              {[-1, -10].map((m) => (
                <button
                  key={`minus-${m}`}
                  onClick={() => handleQuickDelta(m)}
                  disabled={busy}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-950/20 hover:bg-amber-500/20 text-amber-400 text-xs transition-all disabled:opacity-50"
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>

          {/* Precise Datetime End Time Picker */}
          <div className="pt-4 border-t border-line/40 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block eyebrow !text-[11px] mb-1.5 text-subtle">
                Set Exact Event End Timestamp
              </label>
              <input
                type="datetime-local"
                value={customEndLocal}
                onChange={(e) => setCustomEndLocal(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
              />
            </div>
            <button
              onClick={handleApplyCustomEndTime}
              disabled={busy || !customEndLocal}
              className="px-4 py-2 rounded-xl bg-plasma border border-plasma/50 text-white font-medium text-xs hover:border-cyan-400 transition-all disabled:opacity-50 shrink-0"
            >
              Update End Time
            </button>
          </div>
        </div>

        {/* Staging & Schedule Card */}
        <div className="rounded-2xl border-2 border-line/80 bg-ink/50 p-6 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-line/40 pb-3">
              <h3 className="font-sora text-sm font-bold uppercase tracking-wider text-fg flex items-center gap-2">
                <Calendar size={16} className="text-cyan-400" />
                Schedule & Staging
              </h3>
            </div>

            {/* Scheduled Start Status Banner */}
            {state === "SCHEDULED" && timeUntilStartSeconds > 0 && (
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-400/40 text-xs font-mono space-y-1">
                <div className="text-cyan-300 font-bold flex items-center gap-1.5">
                  <Clock size={13} className="text-cyan-400 animate-pulse" />
                  Scheduled Launch in Progress
                </div>
                <div className="text-subtle text-[11px]">
                  Starts: {new Date(config.start_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </div>
                <div className="text-cyan-400 font-black text-sm pt-0.5">
                  T-MINUS: {timeUntilStartFormatted}
                </div>
              </div>
            )}

            {/* Schedule Start Time Picker */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block eyebrow !text-[11px] mb-1.5 text-subtle">
                  Schedule Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleStartLocal}
                  onChange={(e) => setScheduleStartLocal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block eyebrow !text-[11px] mb-1.5 text-subtle">
                  Event Duration
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[36, 24, 12].map((hrs) => (
                    <button
                      key={`dur-${hrs}`}
                      type="button"
                      onClick={() => setScheduleDurationHours(hrs)}
                      className={`py-1.5 px-2 rounded-lg text-xs font-mono font-bold transition-all border ${
                        scheduleDurationHours === hrs
                          ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                          : "bg-panel/40 border-line text-subtle hover:text-fg"
                      }`}
                    >
                      {hrs}h
                    </button>
                  ))}
                </div>
              </div>

              {calculatedEndTimePreview && (
                <div className="text-[10px] font-mono text-subtle bg-void/60 p-2 rounded-lg border border-line/60">
                  <span className="text-cyan-400 font-bold">Calculated End: </span>
                  {calculatedEndTimePreview}
                </div>
              )}

              <button
                type="button"
                onClick={handleApplySchedule}
                disabled={busy || !scheduleStartLocal}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-cyan-500/60 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-mono font-bold text-xs transition-all shadow-sm disabled:opacity-50 active:scale-[0.99]"
              >
                <Calendar size={14} />
                Set Scheduled Start
              </button>
            </div>

            {/* Event Metadata Preview */}
            <div className="p-3.5 rounded-xl bg-void/60 border border-line/60 text-[11px] text-subtle space-y-1 font-mono">
              <div>Progress: {progressPercentage}</div>
              <div>Timezone: {config.timezone}</div>
              <div>Start: {new Date(config.start_at).toLocaleString("en-IN")}</div>
              <div>End: {new Date(config.end_at).toLocaleString("en-IN")}</div>
            </div>
          </div>

          {/* Emergency Manual End Event Button */}
          <div className="pt-4 border-t border-line/40">
            <button
              type="button"
              onClick={() => setConfirmEndOpen(true)}
              disabled={busy || state === "COMPLETED"}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-ember/60 bg-ember/15 hover:bg-ember/25 text-ember font-mono font-bold text-xs transition-all shadow-[0_0_12px_rgba(173,13,3,0.2)] disabled:opacity-40"
            >
              <Square size={14} fill="currentColor" />
              END EVENT (MANUAL TERMINATION)
            </button>
          </div>
        </div>
      </div>

      {/* ── 3. LIVE CHECKPOINT ORCHESTRATION CONSOLE ─────────────────── */}
      <div className="rounded-2xl border-2 border-[#8B5CF6]/50 bg-[#8B5CF6]/10 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#8B5CF6]/30 pb-3">
          <div className="flex items-center gap-2">
            <Radio size={16} className="text-[#8B5CF6] animate-pulse" />
            <h3 className="font-sora text-sm font-bold uppercase tracking-wider text-fg">
              Live Checkpoint Gating & Orchestration
            </h3>
          </div>
          <span className="text-xs font-mono text-subtle">
            Manual Sign-Off & Overtime Holding
          </span>
        </div>

        {currentEvent ? (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-ink border-2 border-line">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-subtle flex items-center gap-2">
                  <span>ACTIVE EVENT:</span>
                  {isCurrentEventOvertime ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold animate-pulse">
                      OVERTIME // WAITING FOR CONFIRMATION
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                      IN DESIGNATED WINDOW
                    </span>
                  )}
                </div>

                <h4 className="text-lg sm:text-xl font-black tracking-tight text-white font-sora mt-1">
                  {currentEvent.title}
                </h4>

                <div className="text-xs font-mono text-subtle mt-0.5">
                  Designated Window:{" "}
                  {new Date(currentEvent.start_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}{" "}
                  –{" "}
                  {new Date(currentEvent.end_at).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })}
                  {currentEvent.location && ` · ${currentEvent.location}`}
                </div>
              </div>

              {/* Action Buttons: Confirm & Complete, or Extend */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleCompleteCheckpoint(currentEvent.id, currentEvent.title)}
                  disabled={busy}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-black text-xs uppercase transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                  title="Mark this event complete and advance to next checkpoint"
                >
                  <CheckCircle2 size={16} />
                  <span>Confirm & Complete Checkpoint</span>
                </button>

                <button
                  onClick={() =>
                    handleExtendCheckpoint(
                      currentEvent.id,
                      5,
                      currentEvent.end_at,
                      currentEvent.title
                    )
                  }
                  disabled={busy}
                  className="px-3 py-3 rounded-xl border border-line bg-panel hover:bg-panel/80 text-xs font-mono font-bold text-fg transition-all disabled:opacity-50"
                  title="Extend this checkpoint by +5 mins"
                >
                  +5m
                </button>

                <button
                  onClick={() =>
                    handleExtendCheckpoint(
                      currentEvent.id,
                      15,
                      currentEvent.end_at,
                      currentEvent.title
                    )
                  }
                  disabled={busy}
                  className="px-3 py-3 rounded-xl border border-line bg-panel hover:bg-panel/80 text-xs font-mono font-bold text-fg transition-all disabled:opacity-50"
                  title="Extend this checkpoint by +15 mins"
                >
                  +15m
                </button>
              </div>
            </div>

            {isCurrentEventOvertime && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-300 flex items-center gap-2 font-mono">
                <span className="h-2 w-2 rounded-full bg-red-400 animate-ping shrink-0" />
                <span>
                  <strong>OVERTIME HOLD ACTIVE:</strong> Designated time has expired, but the public timer will continue to hold "{currentEvent.title}" on the screen until you approve completion above.
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-ink/50 border border-line text-xs text-subtle font-mono text-center">
            {nextEvent
              ? `Next checkpoint: "${nextEvent.title}" starting at ${new Date(nextEvent.start_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}.`
              : "All checkpoints completed."}
          </div>
        )}
      </div>

      {/* ── 3. TIMELINE CHECKPOINTS CRUD MANAGER ─────────────────────── */}
      <div className="rounded-2xl border-2 border-line/80 bg-ink/50 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line/40 pb-4">
          <div>
            <h3 className="font-sora text-base font-bold uppercase tracking-wider text-fg flex items-center gap-2">
              <Calendar size={18} className="text-cyan-400" />
              Metro Timeline Checkpoints
            </h3>
            <p className="text-xs text-subtle mt-0.5">
              Positions are mathematically proportional to start timestamps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setConfirmRealignCheckpointsOpen(true)}
              disabled={busy || !config.start_at}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/40 font-mono text-xs font-bold transition-all shadow-sm shrink-0"
              title="Re-align all 15 checkpoints starting from when the timer launched"
            >
              <RotateCw size={13} />
              Re-align to Timer Launch
            </button>

            <button
              onClick={() => setConfirmRestoreCheckpointsOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/40 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/40 font-mono text-xs font-bold transition-all shadow-sm shrink-0"
              title="Restore official SPECATHON 2026 schedule with verified durations"
            >
              <Sparkles size={13} />
              Restore Official Checkpoints
            </button>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-plasma hover:bg-plasma/80 border border-plasma/50 text-white font-semibold text-xs transition-all shadow-sm shrink-0"
            >
              <Plus size={14} />
              Add Checkpoint
            </button>
          </div>
        </div>

        {/* Checkpoint Table */}
        <div className="overflow-x-auto rounded-xl border border-line bg-void">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-panel/40 font-mono text-[11px] uppercase tracking-wider text-subtle">
              <tr>
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Start Time (IST)</th>
                <th className="py-3 px-4">End Time (IST)</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-center">Visible</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/40 font-mono">
              {synchronizedEvents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted">
                    No checkpoints defined. Click "Add Checkpoint" to begin.
                  </td>
                </tr>
              ) : (
                synchronizedEvents.map((evt) => (
                  <tr
                    key={evt.id}
                    className={`hover:bg-panel/20 transition-colors ${
                      !evt.is_visible ? "opacity-40" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-subtle">{evt.sort_order}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-fg">
                      {evt.title}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-panel border border-line text-cyan-400 uppercase">
                        {evt.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-subtle">
                      {new Date(evt.start_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      {new Date(evt.start_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td className="py-3 px-4 text-subtle">
                      {new Date(evt.end_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      {new Date(evt.end_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </td>
                    <td className="py-3 px-4 text-subtle">
                      {evt.location || "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {evt.is_visible ? (
                        <span className="text-emerald-400">●</span>
                      ) : (
                        <span className="text-muted">○</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {evt.is_completed ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase">
                          <Check size={10} strokeWidth={3} />
                          DONE
                        </span>
                      ) : evt.id === currentEvent?.id ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            isCurrentEventOvertime
                              ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                              : "bg-amber-500/20 text-amber-400 border-amber-500/40 animate-pulse"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-ping" />
                          {isCurrentEventOvertime ? "OVERTIME" : "ACTIVE"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-panel border border-line text-subtle uppercase">
                          UPCOMING
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 font-sans">
                        {evt.is_completed ? (
                          <button
                            onClick={() => handleReopenCheckpoint(evt.id, evt.title)}
                            disabled={busy}
                            className="px-2 py-1 rounded-lg bg-panel hover:bg-panel/80 text-[11px] font-mono text-cyan-300 transition-colors"
                            title="Reopen Checkpoint"
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            onClick={() => handleCompleteCheckpoint(evt.id, evt.title)}
                            disabled={busy}
                            className="px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 hover:bg-emerald-500/30 text-[11px] font-mono font-bold text-emerald-300 transition-colors"
                            title="Mark Checkpoint as Done"
                          >
                            Mark Done
                          </button>
                        )}
                        <button
                          onClick={() => handleExtendCheckpoint(evt.id, 5, evt.end_at, evt.title)}
                          disabled={busy}
                          className="px-2 py-1 rounded-lg bg-panel hover:bg-panel/80 text-[11px] font-mono text-subtle hover:text-fg transition-colors"
                          title="Add +5m to this checkpoint"
                        >
                          +5m
                        </button>
                        <button
                          onClick={() => openEditModal(evt)}
                          className="p-1.5 rounded-lg hover:bg-panel text-subtle hover:text-cyan-400 transition-colors"
                          title="Edit Checkpoint"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(evt.id)}
                          className="p-1.5 rounded-lg hover:bg-panel text-subtle hover:text-ember transition-colors"
                          title="Delete Checkpoint"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CREATE / EDIT CHECKPOINT ─────────────────────────── */}
      {eventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border-2 border-line bg-ink p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line/50 pb-3">
              <h3 className="font-sora text-base font-bold text-fg">
                {editingEvent ? "Edit Checkpoint" : "Add New Checkpoint"}
              </h3>
              <button
                onClick={() => setEventModalOpen(false)}
                className="text-subtle hover:text-fg text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block eyebrow !text-[11px] mb-1">
                  Checkpoint Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Checkpoint 1 — Initial Evaluation"
                  className="w-full px-3 py-2 rounded-xl bg-void border border-line text-sm text-fg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block eyebrow !text-[11px] mb-1">
                    Event Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as TimerEventType)}
                    className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
                  >
                    <option value="milestone">Milestone</option>
                    <option value="evaluation">Evaluation</option>
                    <option value="mentoring">Mentoring</option>
                    <option value="break">Break / Meals</option>
                    <option value="submission">Submission</option>
                    <option value="general">General</option>
                  </select>
                </div>

                <div>
                  <label className="block eyebrow !text-[11px] mb-1">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSort}
                    onChange={(e) => setFormSort(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block eyebrow !text-[11px] mb-1">
                    Start Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block eyebrow !text-[11px] mb-1">
                    End Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formEnd}
                    onChange={(e) => setFormEnd(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs font-mono text-fg focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block eyebrow !text-[11px] mb-1">
                  Location / Venue
                </label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="e.g. Hacking Arena / Main Auditorium"
                  className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs text-fg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block eyebrow !text-[11px] mb-1">
                  Brief Description
                </label>
                <textarea
                  rows={2}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Details for participants on the public screen"
                  className="w-full px-3 py-2 rounded-xl bg-void border border-line text-xs text-fg focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="visibleCheck"
                  checked={formVisible}
                  onChange={(e) => setFormVisible(e.target.checked)}
                  className="rounded border-line bg-void text-cyan-500 focus:ring-0 h-4 w-4"
                />
                <label
                  htmlFor="visibleCheck"
                  className="text-xs font-medium text-fg cursor-pointer"
                >
                  Visible on public timeline
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-line/40">
                <button
                  type="button"
                  onClick={() => setEventModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-line text-xs text-subtle hover:text-fg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-plasma border border-plasma/50 text-white font-semibold text-xs hover:border-cyan-400 transition-all disabled:opacity-50"
                >
                  Save Checkpoint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: AUDIT LOG DRAWER ─────────────────────────────────── */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl border-2 border-line bg-ink p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line/50 pb-3">
              <h3 className="font-sora text-base font-bold text-fg flex items-center gap-2">
                <History size={16} className="text-cyan-400" />
                Timer Audit History
              </h3>
              <button
                onClick={() => setShowAuditModal(false)}
                className="text-subtle hover:text-fg text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-line/40 text-xs font-mono">
              {loadingAudit ? (
                <div className="py-8 text-center text-muted">Loading audit records…</div>
              ) : auditLogs.length === 0 ? (
                <div className="py-8 text-center text-muted">No audit logs recorded yet.</div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-cyan-400 uppercase">{log.action}</span>
                        <span className="text-[10px] text-muted">by {log.actor}</span>
                      </div>
                      <div className="text-[11px] text-subtle mt-0.5">
                        {log.meta?.delta_minutes !== undefined && (
                          <span>
                            Delta: {log.meta.delta_minutes > 0 ? `+${log.meta.delta_minutes}` : log.meta.delta_minutes}m | New End: {new Date(log.meta.new_end_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {log.meta?.event_title && (
                          <span>Event: "{log.meta.event_title}"</span>
                        )}
                        {log.meta?.manual_termination && (
                          <span className="text-ember font-bold">Manual Termination Activated</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted shrink-0">
                      {new Date(log.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION DIALOGS ────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmResetOpen}
        title="Reset Hackathon Timer?"
        description="Are you sure you want to reset the hackathon timer? This will set the timer state back to Scheduled with the full 36:00:00 duration. Participants and projector screens will see the clock ready to start."
        confirmLabel="Yes, Reset Timer (36:00:00)"
        destructive={false}
        onConfirm={handleResetTimerConfirm}
        onCancel={() => setConfirmResetOpen(false)}
      />

      <ConfirmDialog
        open={confirmRestoreCheckpointsOpen}
        title="Restore Official Checkpoints Schedule?"
        description="This will restore all 15 checkpoints to the official SPECATHON 2026 schedule with canonical event durations (2h for evaluations, 1h for lunch/dinner, 30m for short break). Any corrupted 0-minute duration rows will be permanently repaired."
        confirmLabel="Yes, Restore Official Schedule"
        destructive={false}
        onConfirm={() => handleRestoreOfficialCheckpoints(false)}
        onCancel={() => setConfirmRestoreCheckpointsOpen(false)}
      />

      <ConfirmDialog
        open={confirmRealignCheckpointsOpen}
        title="Re-align Checkpoints to Current Timer?"
        description={`This will shift all 15 checkpoints so that the schedule begins when your hackathon timer launched (${config.start_at ? new Date(config.start_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "current time"}). This eliminates artificial overtime caused by starting at an unscheduled hour.`}
        confirmLabel="Yes, Re-align Checkpoints"
        destructive={false}
        onConfirm={() => handleRestoreOfficialCheckpoints(true)}
        onCancel={() => setConfirmRealignCheckpointsOpen(false)}
      />

      <ConfirmDialog
        open={confirmEndOpen}
        title="Terminate Event Immediately?"
        description="Are you sure you want to end SPECATHON 2026? This will set remaining time to 00:00:00, lock all timelines, mark the status as completed, and update all connected screens in real time."
        confirmLabel="Yes, End Event"
        destructive={true}
        onConfirm={handleEndEventConfirm}
        onCancel={() => setConfirmEndOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteConfirmId)}
        title="Delete Checkpoint"
        description="Are you sure you want to remove this milestone from the timeline? This change will propagate to the public screen immediately."
        confirmLabel="Delete"
        destructive={true}
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}
