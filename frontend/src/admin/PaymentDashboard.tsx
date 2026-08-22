import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, AlertCircle, RefreshCcw, Search, X, Copy,
  Users, CreditCard, CheckCircle2, XCircle, Clock,
  ChevronRight, ArrowDownRight, StickyNote,
} from "lucide-react";
import {
  listShortlistedTeams,
  listPaymentEventsForTeam,
  updatePaymentNotes,
  provisionTeamCredentials,
  bulkProvisionCredentials,
  getTeamCredential,
  markPaymentAsPaid,
  type ShortlistedTeamFull,
  type PaymentEvent,
  type BulkProvisionResult,
} from "@/services/admin";
import { useAuth } from "./AuthContext";
import { Eye } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  PAID: {
    label: "Paid",
    icon: CheckCircle2,
    cls: "border-lumen/30 bg-lumen/[0.08] text-lumen",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    cls: "border-ember/30 bg-ember/[0.08] text-ember",
  },
  PENDING: {
    label: "Pending",
    icon: Clock,
    cls: "border-gold/30 bg-gold/[0.08] text-gold",
  },
} as const;

function StatusBadge({ status }: { status: ShortlistedTeamFull["payment_status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium tracking-wide ${cfg.cls}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Event type badge (timeline)
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  ORDER_CREATED: { label: "Order Created", cls: "text-muted", dot: "bg-muted/60" },
  PAYMENT_SUCCESS: { label: "Payment Success", cls: "text-lumen", dot: "bg-lumen" },
  PAYMENT_FAILED: { label: "Payment Failed", cls: "text-ember", dot: "bg-ember" },
  PAYMENT_REFUNDED: { label: "Payment Refunded", cls: "text-gold", dot: "bg-gold" },
  WEBHOOK_RECEIVED: { label: "Webhook Received", cls: "text-muted", dot: "bg-plasma/60" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

type FetchState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; teams: ShortlistedTeamFull[] };

export default function PaymentDashboard({ lastImport }: { lastImport: number }) {
  const [state, setState] = useState<FetchState>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ShortlistedTeamFull | null>(null);
  
  const { session } = useAuth();
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [credentialsModal, setCredentialsModal] = useState<{ teamId: string, password: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkProvisionResult | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const teams = await listShortlistedTeams();
      setState({ kind: "ok", teams });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to load payment data.",
      });
    }
  }, []);

  // Re-fetch on mount AND whenever a new import completes
  useEffect(() => { load(); }, [load, lastImport]);

  // Client-side search — filter by team_id or team_name
  const teams = state.kind === "ok" ? state.teams : [];
  const filtered = query.trim()
    ? teams.filter(
      (t) =>
        t.team_id.toLowerCase().includes(query.toLowerCase()) ||
        t.team_name.toLowerCase().includes(query.toLowerCase())
    )
    : teams;

  // Summary counts
  const counts = { PAID: 0, FAILED: 0, PENDING: 0 };
  for (const t of teams) counts[t.payment_status]++;

  const handleProvision = async (team: ShortlistedTeamFull) => {
    if (!session) return;
    setProvisioningId(team.team_id);
    try {
      const res = await provisionTeamCredentials(team.team_id, session.access_token);
      if (res.success && res.password) {
        setCredentialsModal({ teamId: team.team_id, password: res.password });
        setState(prev => prev.kind === "ok" ? {
          ...prev,
          teams: prev.teams.map(t => t.id === team.id ? { ...t, auth_id: "provisioned" } : t)
        } : prev);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to provision");
    } finally {
      setProvisioningId(null);
    }
  };

  const copyCreds = () => {
    if (!credentialsModal) return;
    navigator.clipboard.writeText(`Team ID: ${credentialsModal.teamId}\nPassword: ${credentialsModal.password}`);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleBulkProvision = async () => {
    if (!session || !confirm("Are you sure you want to run bulk provisioning?")) return;
    setBulkLoading(true);
    try {
      const res = await bulkProvisionCredentials(session.access_token);
      setBulkResult(res);
      // Reload the table in the background
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk provisioning failed");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <CreditCard size={11} /> V2 · Payments
          </div>
          <h2 className="font-display text-2xl md:text-3xl tracking-tightest mt-2">
            Payment Dashboard
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBulkProvision}
            disabled={bulkLoading || state.kind === "loading"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-plasma/30 bg-plasma/10 text-plasma text-xs hover:bg-plasma/20 transition-colors disabled:opacity-50"
          >
            {bulkLoading && <Loader2 size={12} className="animate-spin" />}
            Bulk Provision
          </button>
          <button
            onClick={load}
            disabled={state.kind === "loading"}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] text-xs hover:border-white/25 disabled:opacity-50"
          >
            <RefreshCcw size={12} className={state.kind === "loading" ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {state.kind === "ok" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total", value: teams.length, cls: "text-fg" },
            { label: "Paid", value: counts.PAID, cls: "text-lumen" },
            { label: "Pending", value: counts.PENDING, cls: "text-gold" },
            { label: "Failed", value: counts.FAILED, cls: "text-ember" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-xl glass p-4">
              <div className="text-xs text-muted uppercase tracking-[0.2em] font-mono mb-1">{label}</div>
              <div className={`font-display text-2xl font-bold tracking-tight ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          type="search"
          placeholder="Search Team ID or Team Name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-line bg-panel/40 pl-10 pr-4 py-2.5 text-sm
                     placeholder:text-muted text-fg focus:border-lumen/60 focus:outline-none
                     hover:border-lumen/30 transition-colors"
        />
      </div>

      {/* States */}
      {state.kind === "loading" && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin text-plasma" />
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <AlertCircle size={24} className="text-ember" />
          <div>
            <p className="text-fg font-medium">Failed to load payment data</p>
            <p className="text-sm text-muted mt-1">{state.message}</p>
          </div>
          <button
            onClick={load}
            className="px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-fg hover:border-lumen/40 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ok" && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Users size={24} className="text-muted" />
          <p className="text-fg font-medium">No payment records found.</p>
          {query && (
            <button
              onClick={() => setQuery("")}
              className="text-xs text-muted hover:text-fg transition-colors"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {state.kind === "ok" && filtered.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm" aria-label="Payment records">
              <thead>
                <tr className="border-b border-line bg-panel/60">
                  {["Team ID", "Team Name", "Team Lead", "Size", "Amount", "Status", "Paid At", "Provisioning", ""].map((h) => (
                    <th key={h} scope="col"
                      className="px-4 py-3.5 text-left text-[10px] font-mono uppercase tracking-[0.24em] text-muted font-medium first:pl-5 last:pr-5 last:text-right">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((team, i) => (
                  <motion.tr
                    key={team.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.02, 0.2) }}
                    className="bg-panel/20 hover:bg-panel/50 transition-colors"
                  >
                    <td className="pl-5 pr-4 py-3.5 font-mono text-xs text-lumen tracking-wider whitespace-nowrap">
                      {team.team_id}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-fg">{team.team_name}</td>
                    <td className="px-4 py-3.5 text-muted">{team.team_lead_name}</td>
                    <td className="px-4 py-3.5 text-muted text-center">{team.team_size}</td>
                    <td className="px-4 py-3.5 font-mono text-fg">
                      ₹{team.amount.toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={team.payment_status} />
                    </td>
                    <td className="px-4 py-3.5 text-muted text-xs font-mono">
                      {team.paid_at
                        ? new Date(team.paid_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                        : "—"
                      }
                    </td>
                    <td className="px-4 py-3.5">
                      {team.auth_id ? (
                        <CredentialCell team={team} />
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleProvision(team); }}
                          disabled={provisioningId === team.team_id}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plasma/15 border border-plasma/30 text-[10px] uppercase tracking-wider text-fg hover:bg-plasma/25 transition-all disabled:opacity-50"
                        >
                          {provisioningId === team.team_id ? <Loader2 size={10} className="animate-spin" /> : null}
                          Provision
                        </button>
                      )}
                    </td>
                    <td className="pr-5 py-3.5 text-right">
                      <button
                        onClick={() => setSelected(team)}
                        aria-label={`View details for ${team.team_id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-lumen transition-colors"
                      >
                        View <ChevronRight size={12} />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((team) => (
              <div key={team.id} className="rounded-2xl border border-line bg-panel/30 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-lumen tracking-wider">{team.team_id}</div>
                    <div className="font-medium text-fg mt-0.5">{team.team_name}</div>
                    <div className="text-xs text-muted mt-0.5">{team.team_lead_name}</div>
                  </div>
                  <StatusBadge status={team.payment_status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-fg">₹{team.amount.toLocaleString("en-IN")}</span>
                  <div className="flex items-center gap-3">
                    {team.auth_id ? (
                      <CredentialCell team={team} />
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleProvision(team); }}
                        disabled={provisioningId === team.team_id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-plasma/15 border border-plasma/30 text-[10px] uppercase tracking-wider text-fg hover:bg-plasma/25 transition-all disabled:opacity-50"
                      >
                        {provisioningId === team.team_id ? <Loader2 size={10} className="animate-spin" /> : null}
                        Provision
                      </button>
                    )}
                    <button
                      onClick={() => setSelected(team)}
                      className="inline-flex items-center gap-1 text-xs text-muted hover:text-lumen transition-colors"
                    >
                      View Details <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Credentials Modal */}
      <AnimatePresence>
        {credentialsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-void/80 backdrop-blur-sm"
              onClick={() => setCredentialsModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-2xl"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-lg font-display tracking-tight text-fg">Credentials Generated</h3>
                  <p className="text-sm text-muted mt-1">Please copy these securely. They will not be shown again.</p>
                </div>
                <button
                  onClick={() => setCredentialsModal(null)}
                  className="p-1 rounded hover:bg-white/5 text-muted hover:text-fg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 font-mono text-sm">
                <div>
                  <div className="text-xs text-muted uppercase tracking-widest mb-1">Team ID</div>
                  <div className="px-3 py-2 bg-void rounded border border-line text-lumen">{credentialsModal.teamId}</div>
                </div>
                <div>
                  <div className="text-xs text-muted uppercase tracking-widest mb-1">Password</div>
                  <div className="px-3 py-2 bg-void rounded border border-line text-fg">{credentialsModal.password}</div>
                </div>
              </div>

              <button
                onClick={copyCreds}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-lumen text-void font-medium hover:bg-lumen/90 transition-colors"
              >
                {copyStatus ? <CheckCircle2 size={16} /> : <Copy size={16} />}
                {copyStatus ? "Copied!" : "Copy Credentials"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {bulkResult && (
          <BulkProvisionModal
            result={bulkResult}
            onClose={() => setBulkResult(null)}
          />
        )}
      </AnimatePresence>

      {/* Details drawer */}
      <AnimatePresence>
        {selected && (
          <PaymentDetailsDrawer
            team={selected}
            onClose={() => setSelected(null)}
            onNotesUpdated={(id, notes) => {
              // Update the in-memory teams list so reopening the drawer shows fresh notes
              setState(prev =>
                prev.kind === "ok"
                  ? {
                    ...prev,
                    teams: prev.teams.map(t =>
                      t.id === id ? { ...t, payment_notes: notes || null } : t
                    ),
                  }
                  : prev
              );
              // Also update the selected team so the current drawer reflects the save
              setSelected(prev => prev && prev.id === id ? { ...prev, payment_notes: notes || null } : prev);
            }}
            onStatusUpdated={(id) => {
              setState(prev =>
                prev.kind === "ok"
                  ? {
                    ...prev,
                    teams: prev.teams.map(t =>
                      t.id === id ? { ...t, payment_status: "PAID", paid_at: new Date().toISOString() } : t
                    ),
                  }
                  : prev
              );
              setSelected(prev => prev && prev.id === id ? { ...prev, payment_status: "PAID", paid_at: new Date().toISOString() } : prev);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Payment Details Drawer
// ─────────────────────────────────────────────────────────────────────────────

function PaymentDetailsDrawer({
  team,
  onClose,
  onNotesUpdated,
  onStatusUpdated,
}: {
  team: ShortlistedTeamFull;
  onClose: () => void;
  onNotesUpdated: (id: string, notes: string) => void;
  onStatusUpdated: (id: string) => void;
}) {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Notes ────────────────────────────────────────────────────────────────
  const MAX_NOTES = 1000;
  const [notes, setNotes] = useState(team.payment_notes ?? "");
  const [savedNotes, setSavedNotes] = useState(team.payment_notes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const isDirty = notes !== savedNotes;
  const tooLong = notes.length > MAX_NOTES;

  const handleSave = async () => {
    if (tooLong) return;
    setSaveState("saving");
    try {
      await updatePaymentNotes(team.id, notes);
      const trimmed = notes.trim().slice(0, MAX_NOTES);
      setSavedNotes(trimmed);
      setNotes(trimmed);
      onNotesUpdated(team.id, trimmed);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleReset = () => { setNotes(savedNotes); setSaveState("idle"); };

  const handleMarkPaid = async () => {
    if (!confirm("Are you sure you want to mark this team's payment as PAID manually?")) return;
    try {
      await markPaymentAsPaid(team.id);
      onStatusUpdated(team.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark as paid");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listPaymentEventsForTeam(team.id);
        if (!cancelled) { setEvents(data); setLoading(false); }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [team.id]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-void/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-void border-l border-line overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Payment details for ${team.team_id}`}
      >
        {/* Drawer header */}
        <div className="sticky top-0 bg-void/95 backdrop-blur-sm border-b border-line px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-lumen tracking-wider">{team.team_id}</div>
            <div className="font-display text-lg tracking-tight mt-0.5">{team.team_name}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close details"
            className="h-8 w-8 rounded-lg border border-line flex items-center justify-center text-muted hover:text-fg hover:border-lumen/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">

          {/* General Information */}
          <section>
            <div className="eyebrow flex items-center gap-2 mb-4">
              <Users size={11} /> General Information
            </div>
            <dl className="space-y-3">
              {[
                { label: "Team ID", value: team.team_id, mono: true },
                { label: "Team Name", value: team.team_name, mono: false },
                { label: "Team Lead", value: team.team_lead_name, mono: false },
                { label: "Team Size", value: `${team.team_size} members`, mono: false },
                { label: "Source", value: team.registration_source, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-center justify-between border-b border-line/60 pb-2.5 last:border-0">
                  <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono shrink-0">{label}</dt>
                  <dd className={`text-sm text-right ${mono ? "font-mono text-fg/80 text-xs" : "font-medium text-fg"}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Payment Information */}
          <section>
            <div className="eyebrow flex items-center gap-2 mb-4">
              <CreditCard size={11} /> Payment Information
            </div>
            <dl className="space-y-3">
              <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono">Amount</dt>
                <dd className="font-display font-bold text-xl text-lumen">
                  ₹{team.amount.toLocaleString("en-IN")}
                </dd>
              </div>
              <div className="flex items-center justify-between border-b border-line/60 pb-2.5">
                <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono">Status</dt>
                <dd className="flex items-center gap-3">
                  <StatusBadge status={team.payment_status} />
                  {team.payment_status !== "PAID" && (
                    <button
                      onClick={handleMarkPaid}
                      className="text-[10px] uppercase font-mono tracking-wider px-2 py-1 bg-plasma/15 border border-plasma/30 text-fg rounded hover:bg-plasma/25 transition-all"
                    >
                      Mark Paid
                    </button>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono">Paid At</dt>
                <dd className="text-sm text-fg font-mono text-xs">
                  {team.paid_at
                    ? new Date(team.paid_at).toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short" })
                    : "—"
                  }
                </dd>
              </div>
            </dl>
          </section>

          {/* Event Timeline */}
          <section>
            <div className="eyebrow flex items-center gap-2 mb-4">
              <ArrowDownRight size={11} /> Event Timeline
            </div>

            {loading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={18} className="animate-spin text-plasma" />
              </div>
            )}

            {error && (
              <p className="text-sm text-ember text-center py-6">{error}</p>
            )}

            {!loading && !error && events.length === 0 && (
              <p className="text-sm text-muted text-center py-6">No events recorded yet.</p>
            )}

            {!loading && !error && events.length > 0 && (
              <div className="relative pl-5">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line" />

                <div className="space-y-5">
                  {events.map((ev) => {
                    const cfg = EVENT_CONFIG[ev.event_type] ?? {
                      label: ev.event_type,
                      cls: "text-muted",
                      dot: "bg-muted/60",
                    };
                    return (
                      <div key={ev.id} className="relative">
                        {/* Dot */}
                        <span className={`absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full border-2 border-void ${cfg.dot}`} />

                        <div className="space-y-1">
                          <div className={`text-sm font-medium ${cfg.cls}`}>
                            {cfg.label}
                          </div>
                          <div className="text-[11px] font-mono text-muted">
                            {new Date(ev.created_at).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "medium",
                            })}
                          </div>
                          {ev.razorpay_order_id && (
                            <div className="text-[10px] font-mono text-muted/70 break-all">
                              Order: {ev.razorpay_order_id}
                            </div>
                          )}
                          {ev.razorpay_payment_id && (
                            <div className="text-[10px] font-mono text-muted/70 break-all">
                              Payment: {ev.razorpay_payment_id}
                            </div>
                          )}
                          <div className="text-[10px] font-mono text-muted/60">
                            ₹{ev.amount.toLocaleString("en-IN")} ·{" "}
                            {ev.signature_verified === true
                              ? "Verified ✓"
                              : ev.signature_verified === false
                                ? "Unverified ✗"
                                : "N/A"
                            }
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
          {/* Payment Notes */}
          <section>
            <div className="eyebrow flex items-center gap-2 mb-4">
              <StickyNote size={11} /> Payment Notes
            </div>

            <div className="space-y-3">
              <div className="relative">
                <textarea
                  id="payment-notes"
                  aria-label="Payment notes"
                  value={notes}
                  onChange={(e) => { setNotes(e.target.value); setSaveState("idle"); }}
                  rows={4}
                  maxLength={MAX_NOTES + 50}
                  placeholder="Internal notes visible to admins only. Never shown to participants."
                  className="
                    w-full rounded-xl border border-line bg-panel/40
                    px-4 py-3 text-sm text-fg placeholder:text-muted/60
                    resize-none focus:border-lumen/60 focus:outline-none
                    hover:border-lumen/30 transition-colors leading-relaxed
                  "
                />
                {/* Character count */}
                <span className={`absolute bottom-3 right-3 text-[10px] font-mono tabular-nums ${tooLong ? "text-ember" : "text-muted/60"
                  }`}>
                  {notes.length}/{MAX_NOTES}
                </span>
              </div>

              {/* Save feedback */}
              {saveState === "saved" && (
                <p className="text-xs text-lumen flex items-center gap-1.5">
                  <CheckCircle2 size={11} /> Saved successfully.
                </p>
              )}
              {saveState === "error" && (
                <p className="text-xs text-ember flex items-center gap-1.5">
                  <AlertCircle size={11} /> Failed to save. Please try again.
                </p>
              )}
              {tooLong && (
                <p className="text-xs text-ember">
                  Notes must be {MAX_NOTES} characters or fewer.
                </p>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={!isDirty || tooLong || saveState === "saving"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
                             bg-plasma/15 border border-plasma/30 text-xs font-medium text-fg
                             hover:bg-plasma/25 hover:border-plasma/50 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saveState === "saving"
                    ? <><Loader2 size={11} className="animate-spin" /> Saving…</>
                    : "Save"
                  }
                </button>
                <button
                  onClick={handleReset}
                  disabled={!isDirty || saveState === "saving"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl
                             border border-line text-xs font-medium text-muted
                             hover:text-fg hover:border-lumen/40 transition-all
                             disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

        </div>
      </motion.aside>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Credential Cell
// ─────────────────────────────────────────────────────────────────────────────

function CredentialCell({ team }: { team: ShortlistedTeamFull }) {
  const { session } = useAuth();
  const [state, setState] = useState<"idle" | "loading" | "showing" | "legacy" | "error">("idle");
  const [password, setPassword] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchCredential = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) return;
    setState("loading");
    try {
      const res = await getTeamCredential(session.access_token, team.team_id);
      if (res.success && res.password) {
        setPassword(res.password);
        setState("showing");
      }
    } catch (err: any) {
      if (err.message.includes("404")) {
        setState("legacy");
      } else {
        setState("error");
      }
    }
  };

  const copyCred = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`Team ID: ${team.team_id}\nPassword: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (state === "legacy") {
    return <span className="text-[10px] uppercase font-mono tracking-wider text-muted px-2 py-1 bg-white/5 rounded">Legacy (N/A)</span>;
  }
  if (state === "error") {
    return <span className="text-[10px] uppercase font-mono tracking-wider text-ember px-2 py-1 bg-ember/10 rounded">Error</span>;
  }
  if (state === "showing") {
    return (
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-fg tracking-wide bg-void px-2 py-1 rounded border border-line">{password}</span>
        <button onClick={copyCred} className="p-1 text-muted hover:text-lumen transition-colors">
          {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={fetchCredential}
      disabled={state === "loading"}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-lumen/30 bg-lumen/10 text-[10px] uppercase font-mono tracking-wider text-lumen hover:bg-lumen/20 transition-colors disabled:opacity-50"
    >
      {state === "loading" ? <Loader2 size={10} className="animate-spin" /> : <Eye size={10} />}
      Show Password
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Provision Modal
// ─────────────────────────────────────────────────────────────────────────────

function BulkProvisionModal({ result, onClose }: { result: BulkProvisionResult; onClose: () => void }) {
  const { results } = result;
  if (!results) return null;

  // Flatten the results into a combined array for table display
  const items: { teamId: string; status: string; password?: string }[] = [];
  
  results.PROVISIONED.forEach(p => items.push({ teamId: p.teamId, status: "PROVISIONED", password: p.password }));
  results.ALREADY_PROVISIONED.forEach(id => items.push({ teamId: id, status: "ALREADY_PROVISIONED" }));
  results.LEGACY.forEach(id => items.push({ teamId: id, status: "LEGACY" }));
  results.INCONSISTENT.forEach(id => items.push({ teamId: id, status: "INCONSISTENT" }));
  results.ORPHANED_AUTH.forEach(id => items.push({ teamId: id, status: "ORPHANED_AUTH" }));
  results.FAILED.forEach(id => items.push({ teamId: id, status: "FAILED" }));

  // Sort by teamId
  items.sort((a, b) => a.teamId.localeCompare(b.teamId));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-void/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-line bg-panel shadow-2xl"
      >
        <div className="flex items-start justify-between p-6 border-b border-line shrink-0">
          <div>
            <h3 className="text-lg font-display tracking-tight text-fg">Bulk Provisioning Report</h3>
            <p className="text-sm text-muted mt-1">Review the statuses and copy newly generated passwords.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/5 text-muted hover:text-fg transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="pb-2 font-mono text-xs text-muted uppercase tracking-wider">Team ID</th>
                <th className="pb-2 font-mono text-xs text-muted uppercase tracking-wider">Status</th>
                <th className="pb-2 font-mono text-xs text-muted uppercase tracking-wider">Credentials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map(item => (
                <tr key={item.teamId}>
                  <td className="py-3 font-mono text-lumen">{item.teamId}</td>
                  <td className="py-3">
                    <span className={`text-[10px] uppercase font-mono tracking-wider px-2 py-1 rounded ${
                      item.status === "PROVISIONED" ? "bg-lumen/10 text-lumen" :
                      item.status === "ALREADY_PROVISIONED" ? "bg-plasma/10 text-plasma" :
                      item.status === "LEGACY" ? "bg-white/10 text-muted" :
                      "bg-ember/10 text-ember"
                    }`}>
                      {item.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3">
                    {item.password ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-fg tracking-wide bg-void px-2 py-1 rounded border border-line">{item.password}</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(`Team ID: ${item.teamId}\nPassword: ${item.password}`)}
                          className="p-1 text-muted hover:text-lumen transition-colors"
                          title="Copy Credential"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    ) : item.status === "LEGACY" ? (
                      <span className="text-xs text-muted italic">Not available (Legacy)</span>
                    ) : item.status === "ALREADY_PROVISIONED" ? (
                      <span className="text-xs text-muted italic">Available in Dashboard</span>
                    ) : item.status === "ORPHANED_AUTH" ? (
                      <span className="text-xs text-ember italic">Recovery required</span>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 border-t border-line shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-lumen text-void font-medium hover:bg-lumen/90 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
