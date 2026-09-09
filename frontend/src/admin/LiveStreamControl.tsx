import { useState, useEffect } from "react";
import { 
  Tv, 
  Check, 
  Sparkles, 
  Trash2, 
  Clock, 
  Sliders, 
  Radio, 
  Link as LinkIcon, 
  AlertCircle,
  ExternalLink,
  Rocket, 
  Users, 
  Utensils, 
  UserCog, 
  FileText, 
  Trophy 
} from "lucide-react";
import { toast } from "sonner";
import { useLiveConfig, LiveConfig } from "@/hooks/useLiveConfig";
import { extractYouTubeId } from "@/utils/youtube";
import { ALL_EVENTS, ScheduleEvent } from "@/constants/schedule";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Users,
  Utensils,
  UserCog,
  FileText,
  Trophy,
};

export default function LiveStreamControl() {
  const { config, updateConfig } = useLiveConfig();

  const [inputUrl, setInputUrl] = useState(config.youtubeUrl || config.youtubeVideoId || "");
  const [extractedId, setExtractedId] = useState<string | null>(config.youtubeVideoId || null);
  const [eventState, setEventState] = useState<LiveConfig["eventState"]>(config.eventState || "LIVE");
  const [activeMode, setActiveMode] = useState<"auto" | "manual">(config.activeMode || "auto");
  const [manualEventId, setManualEventId] = useState<string | null>(config.manualActiveEventId);
  const [saving, setSaving] = useState(false);

  // Sync state if config updates from another session
  useEffect(() => {
    setInputUrl(config.youtubeUrl || config.youtubeVideoId || "");
    setExtractedId(config.youtubeVideoId || null);
    setEventState(config.eventState || "LIVE");
    setActiveMode(config.activeMode || "auto");
    setManualEventId(config.manualActiveEventId);
  }, [config]);

  // Handle URL change & live ID extraction
  const handleUrlChange = (val: string) => {
    setInputUrl(val);
    const id = extractYouTubeId(val);
    setExtractedId(id);
  };

  // Save all live stream & schedule settings
  const handleSave = () => {
    setSaving(true);
    const finalVideoId = extractedId || "";

    updateConfig({
      youtubeUrl: inputUrl.trim(),
      youtubeVideoId: finalVideoId,
      eventState,
      activeMode,
      manualActiveEventId: activeMode === "manual" ? manualEventId : null,
    });

    setTimeout(() => {
      setSaving(false);
      toast.success("Live Stream & Up Next schedule settings updated successfully!");
    }, 200);
  };

  const handleClearStream = () => {
    setInputUrl("");
    setExtractedId(null);
    updateConfig({
      youtubeUrl: "",
      youtubeVideoId: "",
    });
    toast.info("Live stream cleared. Stream starting soon placeholder is now active.");
  };

  const handleSetEventActive = (event: ScheduleEvent) => {
    setActiveMode("manual");
    setManualEventId(event.id);
    updateConfig({
      activeMode: "manual",
      manualActiveEventId: event.id,
    });
    toast.success(`Set "${event.name}" as the active Up Next event!`);
  };

  const handleSetAutoMode = () => {
    setActiveMode("auto");
    setManualEventId(null);
    updateConfig({
      activeMode: "auto",
      manualActiveEventId: null,
    });
    toast.info("Switched to Automatic (clock-based) schedule mode.");
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-panel/50 border border-cyan-400/20 backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Live Stream &amp; Schedule Controller
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Control the YouTube live stream embed and manually manage the Up Next schedule.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary !px-5 !py-2.5 text-xs font-semibold tracking-wider uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(47,147,173,0.4)] cursor-pointer"
          >
            <Check size={14} />
            {saving ? "Saving..." : "Save & Broadcast"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: YouTube Stream Configuration */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card-team p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2.5">
                <Tv size={18} className="text-cyan-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  YouTube Live Stream URL
                </h2>
              </div>
              {extractedId && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                  <Check size={10} /> ID: {extractedId}
                </span>
              )}
            </div>

            {/* Input field */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span>Stream URL or Video ID</span>
                <span className="text-[10px] text-slate-500">Supports watch, live, youtu.be &amp; direct ID</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <LinkIcon size={14} />
                </div>
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or https://youtube.com/live/..."
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-black/40 border border-line focus:border-cyan-400/70 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 text-sm text-fg placeholder:text-slate-600 transition-all font-mono"
                />
                {inputUrl && (
                  <button
                    type="button"
                    onClick={() => handleUrlChange("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-white transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              {inputUrl && !extractedId && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5 pt-1 font-mono">
                  <AlertCircle size={12} /> Could not extract a valid 11-character YouTube video ID from this input.
                </p>
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleClearStream}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-950/20 text-red-400 hover:bg-red-900/30 hover:border-red-500/40 text-xs font-medium transition-all"
              >
                <Trash2 size={12} /> Clear Stream (Show Placeholder)
              </button>
              {extractedId && (
                <a
                  href={`https://www.youtube.com/watch?v=${extractedId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 hover:text-white hover:border-white/25 text-xs font-medium transition-all"
                >
                  <ExternalLink size={12} /> Open on YouTube
                </a>
              )}
            </div>

            {/* Live Preview Embed */}
            <div className="pt-2 space-y-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Stream Embed Preview:</span>
              <div className="w-full aspect-video rounded-xl border border-white/10 bg-black/60 overflow-hidden relative flex items-center justify-center">
                {extractedId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${extractedId}?autoplay=0&rel=0`}
                    title="Live Stream Preview"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                      <div className="absolute inset-1 rounded-full border border-indigo/40 border-b-plasma animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Stream Starting Soon</p>
                      <p className="text-xs text-slate-500 mt-0.5">No video ID configured. Visitors will see the rotating loading placeholder.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Event Phase State */}
          <div className="card-team p-6 sm:p-7 space-y-4">
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] pb-3">
              <Sliders size={18} className="text-cyan-400" />
              <h2 className="font-display text-lg font-semibold text-white">
                Event Display State
              </h2>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Choose the headline mode displayed at the hero section on the homepage:
            </p>

            <div className="grid grid-cols-3 gap-3">
              {(["BEFORE", "LIVE", "AFTER"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setEventState(st);
                    updateConfig({ eventState: st });
                    toast.success(`Event state set to: ${st}`);
                  }}
                  className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    eventState === st
                      ? "border-cyan-400 bg-cyan-950/40 shadow-[0_0_20px_rgba(34,211,238,0.2)] text-white font-bold"
                      : "border-white/10 bg-black/20 text-slate-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  <div className="text-xs font-mono tracking-wider">{st}</div>
                  <div className="text-[10px] text-slate-400 mt-1 font-sans">
                    {st === "BEFORE" ? "The Wait Is Almost Over" : st === "LIVE" ? "Live Stream & Schedule" : "Event Has Ended"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: "Up Next" Schedule Manual Controller */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card-team p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div className="flex items-center gap-2.5">
                <Clock size={18} className="text-cyan-400" />
                <h2 className="font-display text-lg font-semibold text-white">
                  "Up Next" Controller
                </h2>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider border ${
                activeMode === "manual" 
                  ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                  : "bg-cyan-950/40 border-cyan-500/40 text-cyan-300"
              }`}>
                {activeMode === "manual" ? "MANUAL OVERRIDE" : "AUTOMATIC"}
              </span>
            </div>

            {/* Mode selection buttons */}
            <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={handleSetAutoMode}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  activeMode === "auto"
                    ? "bg-cyan-950/80 border border-cyan-400/40 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Auto by Clock
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMode("manual");
                  if (!manualEventId && ALL_EVENTS[0]) {
                    setManualEventId(ALL_EVENTS[0].id);
                  }
                  updateConfig({ activeMode: "manual", manualActiveEventId: manualEventId || ALL_EVENTS[0].id });
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                  activeMode === "manual"
                    ? "bg-cyan-950/80 border border-cyan-400/40 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Manual Selection
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {activeMode === "manual"
                ? "Click any event below to immediately activate it as the highlighted Up Next item on the homepage."
                : "The website currently calculates the active schedule event automatically based on the current time."}
            </p>

            {/* List of Schedule Events */}
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 hide-scrollbar">
              {ALL_EVENTS.map((event) => {
                const Icon = ICONS[event.iconName] || Rocket;
                const isSelected = activeMode === "manual" && manualEventId === event.id;

                return (
                  <div
                    key={event.id}
                    onClick={() => handleSetEventActive(event)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                      isSelected
                        ? "border-cyan-400/80 bg-cyan-950/40 shadow-[0_0_20px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40"
                        : "border-white/[0.08] bg-black/25 hover:border-cyan-400/40 hover:bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                        isSelected ? "bg-cyan-400/20 text-cyan-300" : "bg-white/[0.04] text-slate-400 group-hover:text-white"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white truncate">
                            {event.name}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400/80 px-1.5 py-0.2 rounded bg-cyan-950/40 border border-cyan-400/20">
                            Day {event.day}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {event.timeLabel}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-400 text-void text-[10px] font-bold font-mono uppercase tracking-wider shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                          <Sparkles size={11} />
                          Active
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-slate-400 group-hover:text-cyan-400 transition-colors px-2 py-1"
                        >
                          Set Active
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
