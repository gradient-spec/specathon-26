import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Toaster, toast } from "sonner";
import {
  AlertTriangle, ArrowLeft, Check, FileSpreadsheet, Gauge, History, LogOut,
  Save, Search, Settings2, ShieldCheck, Upload, Users, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/admin/AuthContext";
import {
  clearScore, deleteVenueGroup, getAdminSummary, getAdminTeams, getAuditLog,
  getVenueGroups, importTeams, saveVenueGroup, seedVenueGroups, setScore,
  updateSettings, updateTeam,
} from "@/leaderboard/service";
import type { AdminSummary, AuditRow, TeamScoreRow, VenueGroup } from "@/leaderboard/types";
import { STAGES } from "@/leaderboard/schedule";
import "@/leaderboard/leaderboard.css";

const stageLabels: Record<string, string> = {
  ROUND_1_UPCOMING: "Round 1 · Upcoming", ROUND_1_LIVE: "Round 1 · Live", ROUND_1_COMPLETED: "Round 1 · Completed",
  ROUND_2_UPCOMING: "Round 2 · Upcoming", ROUND_2_LIVE: "Round 2 · Live", ROUND_2_COMPLETED: "Round 2 · Completed",
  FINAL_UPCOMING: "Final · Upcoming", FINAL_LIVE: "Final · Live", FINAL_COMPLETED: "Final · Completed",
  RESULTS_LIVE: "Results · Live",
};

const SCHEDULE_FIELDS = [
  { key: "round1StartAt", label: "Round 1 start", after: null },
  { key: "round1EndAt", label: "Round 1 end", after: "round1StartAt" },
  { key: "round2StartAt", label: "Round 2 start", after: "round1EndAt" },
  { key: "round2EndAt", label: "Round 2 end", after: "round2StartAt" },
  { key: "finalStartAt", label: "Final start", after: "round2EndAt" },
  { key: "finalEndAt", label: "Final end", after: "finalStartAt" },
] as const;

const toLocalInput = (value: unknown): string => {
  if (!value) return "";
  const d = new Date(value as string | Date);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const toIsoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const d = new Date(value as string | Date);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

type SettingsDraft = Record<string, unknown>;
type ParsedTeam = { teamId: string; teamName: string; venue: string };
type Validation = { rows: ParsedTeam[]; errors: string[]; fileName: string };
type Tab = "overview" | "teams" | "import" | "settings" | "audit";

/* Lightweight polling helper — replaces react-query's refetchInterval. */
function usePoll<T>(fn: () => Promise<T>, intervalMs: number, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    try { setData(await fnRef.current()); } catch (e) { toast.error(e instanceof Error ? e.message : "Load failed"); }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    void reload();
    const id = setInterval(reload, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, reload]);
  return { data, reload };
}

export default function LeaderboardAdmin() {
  const { email, signOut } = useAuth();
  return (
    <>
      <Toaster theme="dark" position="top-right" richColors closeButton />
      <AdminConsole userName={email ?? "Administrator"} logout={signOut} />
    </>
  );
}

function AdminConsole({ userName, logout }: { userName: string; logout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [venue, setVenue] = useState("ALL");
  const [validation, setValidation] = useState<Validation | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const summary = usePoll<AdminSummary>(getAdminSummary, 5000);
  const teams = usePoll<TeamScoreRow[]>(
    () => getAdminTeams({ search: search || undefined, venue: venue === "ALL" ? undefined : venue }),
    5000,
    tab === "teams",
  );
  const groups = usePoll<VenueGroup[]>(getVenueGroups, 10000);
  const audit = usePoll<AuditRow[]>(() => getAuditLog(50), 5000, tab === "audit");

  // Re-query the roster promptly when the search box or venue filter changes
  // (the 5s poll would otherwise lag the input).
  const reloadTeams = teams.reload;
  useEffect(() => {
    if (tab !== "teams") return;
    const id = setTimeout(() => void reloadTeams(), 250);
    return () => clearTimeout(id);
  }, [search, venue, tab, reloadTeams]);

  const refreshAll = () => { void summary.reload(); void teams.reload(); void groups.reload(); void audit.reload(); };
  const run = async (label: string, action: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    try { await action(); toast.success(label); after?.(); refreshAll(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  const settings: SettingsDraft | undefined =
    settingsDraft ?? (summary.data?.settings as unknown as SettingsDraft | undefined);

  const validateWorkbook = async (file: File) => {
    const errors: string[] = [];
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      setValidation({ rows: [], errors: ["Unsupported file format. Upload a .xlsx or .xls workbook."], fileName: file.name });
      return;
    }
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "" });
    if (!matrix.length) { setValidation({ rows: [], errors: ["The spreadsheet is empty."], fileName: file.name }); return; }
    const headers = (matrix[0] as unknown[]).map((value) => String(value).trim().toLowerCase());
    const missing = ["team id", "team name"].filter((column) => !headers.includes(column));
    if (missing.length) errors.push(`Missing required column(s): ${missing.join(", ")}`);
    const indices = { teamId: headers.indexOf("team id"), teamName: headers.indexOf("team name"), venue: headers.indexOf("venue") };
    const rows: ParsedTeam[] = [];
    const seen = new Map<string, number>();
    (matrix.slice(1) as unknown[][]).forEach((raw, offset) => {
      const rowNumber = offset + 2;
      const values = {
        teamId: String(raw[indices.teamId] ?? "").trim(),
        teamName: String(raw[indices.teamName] ?? "").trim(),
        venue: indices.venue >= 0 ? String(raw[indices.venue] ?? "").trim() : "",
      };
      if (!values.teamId && !values.teamName && !values.venue) return;
      if (!values.teamId) errors.push(`Row ${rowNumber}: Missing Team ID`);
      if (!values.teamName) errors.push(`Row ${rowNumber}: Missing Team Name`);
      if (values.venue && !/^[a-z0-9 +/&_-]{1,32}$/i.test(values.venue)) errors.push(`Row ${rowNumber}: Invalid Venue "${values.venue}" (under 32 chars, letters/numbers only).`);
      if (values.teamId) {
        const normalized = values.teamId.toUpperCase();
        if (seen.has(normalized)) errors.push(`Row ${rowNumber}: Duplicate Team ID ${values.teamId} (first seen on row ${seen.get(normalized)})`);
        else seen.set(normalized, rowNumber);
      }
      rows.push(values);
    });
    if (!rows.length && !errors.length) errors.push("No team rows detected after ignoring empty rows.");
    setValidation({ rows, errors, fileName: file.name });
  };

  const saveSettings = () => {
    if (!settings) return;
    void run("Event controls saved", () => updateSettings({
      currentStage: String(settings.currentStage),
      round1MaxScore: Number(settings.round1MaxScore),
      round2MaxScore: Number(settings.round2MaxScore),
      autoAdvance: settings.autoAdvance !== false,
      round1StartAt: toIsoOrNull(settings.round1StartAt), round1EndAt: toIsoOrNull(settings.round1EndAt),
      round2StartAt: toIsoOrNull(settings.round2StartAt), round2EndAt: toIsoOrNull(settings.round2EndAt),
      finalStartAt: toIsoOrNull(settings.finalStartAt), finalEndAt: toIsoOrNull(settings.finalEndAt),
    }), () => setSettingsDraft(null));
  };

  const navItems: Array<{ key: Tab; Icon: LucideIcon; label: string }> = [
    { key: "overview", Icon: Gauge, label: "Overview" },
    { key: "teams", Icon: Users, label: "Team management" },
    { key: "import", Icon: FileSpreadsheet, label: "Excel import" },
    { key: "settings", Icon: Settings2, label: "Event controls" },
    { key: "audit", Icon: History, label: "Audit log" },
  ];

  return (
    <div className="lb-root admin-app">
      <aside className="admin-sidebar">
        <div className="admin-brand brand-link">
          <div className="brand-mark"><img src="/gradient-club-logo.png" alt="Gradient Club" /></div>
          <div>
            <p className="eyebrow" style={{ color: "#67e8f9" }}>GRADIENT CLUB</p>
            <p className="font-display text-sm font-semibold" style={{ color: "#fff" }}>SPECATHON 2026</p>
          </div>
        </div>
        <div className="mt-10">
          <p className="eyebrow mb-3 px-3" style={{ color: "#64748b" }}>Control center</p>
          <nav className="space-y-1">
            {navItems.map(({ key, Icon, label }) => (
              <button key={key} onClick={() => setTab(key)} className={`admin-nav ${tab === key ? "active" : ""}`}>
                <Icon size={17} />{label}
              </button>
            ))}
          </nav>
        </div>
        <div className="mt-auto pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="mb-4 flex items-center gap-3 px-3">
            <div className="avatar-small">{userName.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: "#fff" }}>{userName}</p>
              <p className="text-xs" style={{ color: "#64748b" }}>Administrator</p>
            </div>
          </div>
          <button onClick={logout} className="admin-nav" style={{ color: "#64748b" }}><LogOut size={17} />Sign out</button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow" style={{ color: "#67e8f9" }}>ADMIN CONTROL CENTER</p>
            <h1 className="font-display mt-2 text-2xl font-semibold" style={{ color: "#fff" }}>
              {tab === "overview" ? "Event overview" : tab === "teams" ? "Team management" : tab === "import" ? "Official Excel import" : tab === "settings" ? "Event controls" : "Score audit trail"}
            </h1>
          </div>
          <Link to="/leaderboard" className="control-link"><ArrowLeft size={14} />Public leaderboard</Link>
        </header>

        <div className="admin-content">
          {tab === "overview" && <Overview summary={summary.data} onNavigate={setTab} />}
          {tab === "teams" && (
            <TeamsTab
              rows={teams.data ?? []}
              search={search} setSearch={setSearch}
              venue={venue} setVenue={setVenue}
              groups={groups.data ?? []}
              onScore={(id, round, score) => run("Score updated and audit logged", () => setScore(id, round, score))}
              onClear={(id, round) => run("Score cleared and audit logged", () => clearScore(id, round))}
              onEdit={(id, teamName, teamVenue) => run("Team details updated", () => updateTeam(id, teamName, teamVenue))}
            />
          )}
          {tab === "import" && (
            <ImportTab
              validation={validation}
              fileRef={fileRef}
              onFile={(file) => void validateWorkbook(file)}
              onImport={() => validation && run(
                `${validation.rows.length} teams imported without overwriting scores`,
                () => importTeams(validation.rows),
                () => { setValidation(null); setTab("teams"); },
              )}
            />
          )}
          {tab === "settings" && (
            <SettingsTab
              settings={settings}
              groups={groups.data ?? []}
              setSettingsDraft={setSettingsDraft}
              saveSettings={saveSettings}
              seedGroups={() => run("Default venue groups created", () => seedVenueGroups())}
              saveGroup={(id, groupName, venues) => run("Venue group saved", () => saveVenueGroup(id, groupName, venues))}
              deleteGroup={(id) => run("Venue group deleted", () => deleteVenueGroup(id))}
            />
          )}
          {tab === "audit" && <AuditTab rows={audit.data ?? []} />}
        </div>
      </main>
    </div>
  );
}

/* ── Overview ────────────────────────────────────────────────────────── */
function Overview({ summary, onNavigate }: { summary: AdminSummary | null; onNavigate: (tab: Tab) => void }) {
  const r1 = summary?.totalTeams ? Math.round((summary.round1Evaluated / summary.totalTeams) * 100) : 0;
  const r2 = summary?.totalTeams ? Math.round((summary.round2Evaluated / summary.totalTeams) * 100) : 0;
  const stageLabel = summary?.settings ? stageLabels[summary.settings.currentStage] : "Loading";
  return (
    <>
      <div className="overview-grid">
        <Metric label="Total teams" value={summary?.totalTeams ?? "—"} caption="Imported from official roster" />
        <Metric label="Round 1 evaluated" value={summary ? `${summary.round1Evaluated}/${summary.totalTeams}` : "—"} caption={`${r1}% complete`} />
        <Metric label="Round 2 evaluated" value={summary ? `${summary.round2Evaluated}/${summary.totalTeams}` : "—"} caption={`${r2}% complete`} />
        <Metric label="Current stage" value={stageLabel.split(" · ")[0]} caption={stageLabel.split(" · ")[1] ?? "Loading"} />
      </div>
      <div className="dashboard-grid mt-6">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow" style={{ color: "#67e8f9" }}>Evaluation progress</p>
              <h2 className="panel-title">Live completion</h2>
            </div>
            <span className="stage-pill live">{stageLabel}</span>
          </div>
          <ProgressLine label="Round 1" value={r1} evaluated={summary?.round1Evaluated ?? 0} total={summary?.totalTeams ?? 0} />
          <ProgressLine label="Round 2" value={r2} evaluated={summary?.round2Evaluated ?? 0} total={summary?.totalTeams ?? 0} />
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <QuickAction label="Manage teams" icon={<Users size={17} />} onClick={() => onNavigate("teams")} />
            <QuickAction label="Import Excel" icon={<Upload size={17} />} onClick={() => onNavigate("import")} />
            <QuickAction label="Event controls" icon={<Settings2 size={17} />} onClick={() => onNavigate("settings")} />
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow" style={{ color: "#67e8f9" }}>Recent changes</p>
              <h2 className="panel-title">Score audit</h2>
            </div>
            <History size={18} style={{ color: "#64748b" }} />
          </div>
          {summary?.recentAudit?.length
            ? <div className="space-y-4">{summary.recentAudit.map((item) => <AuditItem key={item.id} item={item} />)}</div>
            : <EmptyPanel text="Score changes will appear here once evaluation begins." />}
        </section>
      </div>
    </>
  );
}

/* ── Teams ───────────────────────────────────────────────────────────── */
function TeamsTab({ rows, search, setSearch, venue, setVenue, groups, onScore, onClear, onEdit }: {
  rows: TeamScoreRow[]; search: string; setSearch: (v: string) => void; venue: string; setVenue: (v: string) => void;
  groups: VenueGroup[];
  onScore: (id: number, round: "ROUND_1" | "ROUND_2", score: number) => void;
  onClear: (id: number, round: "ROUND_1" | "ROUND_2") => void;
  onEdit: (id: number, name: string, venue: string) => void;
}) {
  const venues = Array.from(new Set(groups.flatMap((group) => group.venues)));
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow" style={{ color: "#67e8f9" }}>Roster and scoring</p>
          <h2 className="panel-title">{rows.length} teams in view</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="search-box">
            <Search size={15} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team…" />
          </label>
          <select className="dark-select" value={venue} onChange={(e) => setVenue(e.target.value)}>
            <option value="ALL">All venues</option>
            {venues.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>
      <div className="table-scroll">
        <table className="admin-table">
          <thead><tr><th>Team</th><th>Venue</th><th>Round 1</th><th>Round 2</th><th>Total</th><th>Save</th></tr></thead>
          <tbody>
            {rows.map((row) => <TeamEditor key={row.id} row={row} onScore={onScore} onClear={onClear} onEdit={onEdit} />)}
            {!rows.length && <tr><td colSpan={6} className="empty-row">No teams match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamEditor({ row, onScore, onClear, onEdit }: {
  row: TeamScoreRow;
  onScore: (id: number, round: "ROUND_1" | "ROUND_2", score: number) => void;
  onClear: (id: number, round: "ROUND_1" | "ROUND_2") => void;
  onEdit: (id: number, name: string, venue: string) => void;
}) {
  const [name, setName] = useState(row.teamName);
  const [venue, setVenue] = useState(row.venue);
  const [r1, setR1] = useState<string>(row.round1Score?.toString() ?? "");
  const [r2, setR2] = useState<string>(row.round2Score?.toString() ?? "");
  const total = (Number(r1) || 0) + (Number(r2) || 0);
  const hasScore = r1 !== "" || r2 !== "";
  return (
    <tr>
      <td>
        <input className="table-input team-input" value={name} onChange={(e) => setName(e.target.value)} />
        <span className="team-id">{row.teamId}</span>
      </td>
      <td><input className="table-input venue-input" value={venue} onChange={(e) => setVenue(e.target.value)} /></td>
      <td><input className="table-input score-input" type="number" min="0" value={r1} onChange={(e) => setR1(e.target.value)} onBlur={() => (r1 === "" ? onClear(row.id, "ROUND_1") : onScore(row.id, "ROUND_1", Number(r1)))} /></td>
      <td><input className="table-input score-input" type="number" min="0" value={r2} onChange={(e) => setR2(e.target.value)} onBlur={() => (r2 === "" ? onClear(row.id, "ROUND_2") : onScore(row.id, "ROUND_2", Number(r2)))} /></td>
      <td className="total-cell">{hasScore ? total : "—"}</td>
      <td><button className="icon-button" onClick={() => onEdit(row.id, name, venue)} aria-label={`Save ${row.teamName}`}><Save size={16} /></button></td>
    </tr>
  );
}

/* ── Import ──────────────────────────────────────────────────────────── */
function ImportTab({ validation, fileRef, onFile, onImport }: {
  validation: Validation | null;
  fileRef: React.RefObject<HTMLInputElement>;
  onFile: (file: File) => void;
  onImport: () => void;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="panel">
        <p className="eyebrow" style={{ color: "#67e8f9" }}>Roster source</p>
        <h2 className="panel-title">Validate before importing</h2>
        <p className="mt-3 text-sm leading-6" style={{ color: "#94a3b8" }}>
          Upload the official workbook. Existing team IDs are updated, new IDs are added, and existing scores are never overwritten.
        </p>
        <div className="mt-6 upload-zone" onClick={() => fileRef.current?.click()}>
          <Upload className="mx-auto mb-3" style={{ color: "#67e8f9" }} size={25} />
          <p className="font-medium" style={{ color: "#fff" }}>Choose .xlsx or .xls file</p>
          <p className="mt-1 text-xs" style={{ color: "#64748b" }}>Required: Team ID, Team Name · Venue optional (blank → TBD)</p>
          <input ref={fileRef} className="hidden" type="file" accept=".xlsx,.xls" onChange={(e) => { const file = e.target.files?.[0]; if (file) onFile(file); }} />
        </div>
        <button
          className="lb-btn-outline mt-5 w-full"
          onClick={() => {
            const sheet = XLSX.utils.json_to_sheet([{ "Team ID": "SPC001", "Team Name": "Team Alpha", Venue: "G1" }]);
            const book = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(book, sheet, "Teams");
            XLSX.writeFile(book, "specathon-2026-team-template.xlsx");
          }}
        >
          <FileSpreadsheet size={16} />Download official template
        </button>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow" style={{ color: "#67e8f9" }}>Validation report</p>
            <h2 className="panel-title">{validation?.fileName ?? "No workbook selected"}</h2>
          </div>
          {validation && (
            <span className={`lb-badge ${validation.errors.length ? "bad" : "ok"}`}>
              {validation.errors.length ? "Import blocked" : "Ready to import"}
            </span>
          )}
        </div>
        {!validation ? (
          <EmptyPanel text="Your validation report will appear here before any data is written to the database." />
        ) : (
          <>
            <div className="validation-summary">
              <div>
                <span className="text-2xl font-semibold" style={{ color: "#fff" }}>{validation.rows.length}</span>
                <span className="ml-2 text-sm" style={{ color: "#64748b" }}>team rows detected</span>
              </div>
              <div style={{ color: validation.errors.length ? "#fda4af" : "#6ee7b7" }}>
                {validation.errors.length ? `${validation.errors.length} issue(s)` : "All checks passed"}
              </div>
            </div>
            {validation.errors.length ? (
              <div className="error-list">
                {validation.errors.map((error, index) => (
                  <div key={index} className="flex gap-2 text-sm" style={{ color: "#fecdd3" }}>
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />{error}
                  </div>
                ))}
              </div>
            ) : (
              <div className="success-callout">
                <Check size={18} />
                <div>
                  <p className="font-medium">Workbook ready</p>
                  <p className="text-sm opacity-75">Team IDs are unique and all required fields are present.</p>
                </div>
              </div>
            )}
            <button disabled={!!validation.errors.length || !validation.rows.length} onClick={onImport} className="lb-btn mt-6 w-full">
              Import validated teams
            </button>
          </>
        )}
      </section>
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────────────────── */
function SettingsTab({ settings, groups, setSettingsDraft, saveSettings, seedGroups, saveGroup, deleteGroup }: {
  settings: Record<string, unknown> | undefined;
  groups: VenueGroup[];
  setSettingsDraft: (value: Record<string, unknown>) => void;
  saveSettings: () => void;
  seedGroups: () => void;
  saveGroup: (id: number | undefined, groupName: string, venues: string[]) => void;
  deleteGroup: (id: number) => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [groupVenues, setGroupVenues] = useState("");
  const [editingId, setEditingId] = useState<number | undefined>();
  const beginEdit = (group: VenueGroup) => { setEditingId(group.id); setGroupName(group.groupName); setGroupVenues(group.venues.join(", ")); };
  const reset = () => { setEditingId(undefined); setGroupName(""); setGroupVenues(""); };
  const submitGroup = () => {
    const venues = groupVenues.split(",").map((item) => item.trim()).filter(Boolean);
    if (!groupName.trim() || !venues.length) return;
    saveGroup(editingId, groupName.trim(), venues);
    reset();
  };
  const autoAdvance = settings?.autoAdvance !== false;
  const setField = (key: string, value: unknown) => setSettingsDraft({ ...(settings ?? {}), [key]: value });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel">
        <p className="eyebrow" style={{ color: "#67e8f9" }}>Stage control</p>
        <h2 className="panel-title">What is live now?</h2>
        <div className="mt-6 space-y-5">
          <label className="schedule-toggle">
            <input type="checkbox" checked={autoAdvance} onChange={(e) => setField("autoAdvance", e.target.checked)} />
            <span>
              <span style={{ color: "#fff" }}>Auto-advance stage on schedule</span>
              <span className="block text-xs" style={{ color: "#64748b" }}>The stage follows the round times below. Turn off to control it by hand.</span>
            </span>
          </label>
          <label className="field-label">
            Current event stage
            {autoAdvance && <span className="ml-2 text-[10px] uppercase tracking-widest" style={{ color: "#67e8f9" }}>on schedule</span>}
            <select className="dark-select mt-2 w-full" disabled={autoAdvance} value={String(settings?.currentStage ?? "ROUND_1_UPCOMING")} onChange={(e) => setField("currentStage", e.target.value)}>
              {STAGES.map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}
            </select>
          </label>
          <div className="schedule-grid">
            {SCHEDULE_FIELDS.map(({ key, label, after }) => (
              <label key={key} className="field-label">
                {label}
                <input
                  className="dark-input mt-2 w-full"
                  type="datetime-local"
                  disabled={!autoAdvance}
                  min={after ? toLocalInput(settings?.[after]) || undefined : undefined}
                  value={toLocalInput(settings?.[key])}
                  onChange={(e) => setField(key, e.target.value)}
                />
                <button type="button" className="schedule-clear" onClick={() => setField(key, "")}>Clear</button>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">Round 1 maximum
              <input className="dark-input mt-2 w-full" type="number" min="1" max="1000" value={Number(settings?.round1MaxScore ?? 40)} onChange={(e) => setField("round1MaxScore", Number(e.target.value))} />
            </label>
            <label className="field-label">Round 2 maximum
              <input className="dark-input mt-2 w-full" type="number" min="1" max="1000" value={Number(settings?.round2MaxScore ?? 40)} onChange={(e) => setField("round2MaxScore", Number(e.target.value))} />
            </label>
          </div>
          <button onClick={saveSettings} className="lb-btn mt-2"><Save size={16} />Save controls</button>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow" style={{ color: "#67e8f9" }}>Venue configuration</p>
        <h2 className="panel-title">Public filter groups</h2>
        <p className="mt-3 text-sm leading-6" style={{ color: "#94a3b8" }}>
          Groups are stored in the database so venue arrangements can change without editing the public application.
        </p>
        <div className="mt-5 grid gap-2">
          <input className="dark-input" placeholder="Group name, e.g. G1 + G2" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <input className="dark-input" placeholder="Venues separated by commas, e.g. G1, G2" value={groupVenues} onChange={(e) => setGroupVenues(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={submitGroup} className="lb-btn">{editingId ? "Update group" : "Add group"}</button>
            {editingId && <button className="lb-btn-outline" onClick={reset}>Cancel</button>}
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {groups.length ? groups.map((group) => (
            <div className="config-row" key={group.id}>
              <div>
                <p className="font-medium" style={{ color: "#fff" }}>{group.groupName}</p>
                <p className="text-xs" style={{ color: "#64748b" }}>{group.venues.join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <button className="icon-button" onClick={() => beginEdit(group)}>Edit</button>
                <button className="icon-button" style={{ color: "#fda4af" }} onClick={() => window.confirm(`Delete venue group ${group.groupName}?`) && deleteGroup(group.id)}>Delete</button>
              </div>
            </div>
          )) : (
            <>
              <EmptyPanel text="No venue groups configured yet." />
              <button className="lb-btn-outline" onClick={seedGroups}>Create default groups</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

/* ── Audit ───────────────────────────────────────────────────────────── */
function AuditTab({ rows }: { rows: AuditRow[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow" style={{ color: "#67e8f9" }}>Traceability</p>
          <h2 className="panel-title">Every score change</h2>
        </div>
        <ShieldCheck style={{ color: "#67e8f9" }} size={20} />
      </div>
      <div className="space-y-3">
        {rows.map((item) => <AuditItem item={item} key={item.id} detailed />)}
        {!rows.length && <EmptyPanel text="No score modifications have been recorded." />}
      </div>
    </section>
  );
}

function AuditItem({ item, detailed = false }: { item: AuditRow; detailed?: boolean }) {
  return (
    <div className="audit-item">
      <div className="audit-icon"><History size={14} /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" style={{ color: "#fff" }}>{item.teamName} <span style={{ color: "#64748b" }}>({item.teamId})</span></p>
        <p className="mt-1 text-xs" style={{ color: "#64748b" }}>
          {item.round.replace("ROUND_", "Round ")} · {item.changedBy ?? "Administrator"} · {new Date(item.changedAt).toLocaleString()}
        </p>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm" style={{ color: "#67e8f9" }}>{item.oldScore ?? "—"} → {item.newScore ?? "—"}</p>
        {detailed && <p className="mt-1 text-[10px] uppercase tracking-widest" style={{ color: "#475569" }}>logged</p>}
      </div>
    </div>
  );
}

function Metric({ label, value, caption }: { label: string; value: string | number; caption: string }) {
  return (
    <div className="metric-card">
      <p className="eyebrow" style={{ color: "#64748b" }}>{label}</p>
      <p className="mt-4 font-display text-3xl font-semibold" style={{ color: "#fff" }}>{value}</p>
      <p className="mt-2 text-xs" style={{ color: "#64748b" }}>{caption}</p>
    </div>
  );
}
function ProgressLine({ label, value, evaluated, total }: { label: string; value: number; evaluated: number; total: number }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex justify-between text-sm">
        <span style={{ color: "#cbd5e1" }}>{label}</span>
        <span className="font-mono" style={{ color: "#67e8f9" }}>{evaluated}/{total} · {value}%</span>
      </div>
      <div className="lb-progress"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
    </div>
  );
}
function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="quick-action">{icon}<span>{label}</span></button>;
}
function EmptyPanel({ text }: { text: string }) {
  return <div className="empty-panel"><p>{text}</p></div>;
}
