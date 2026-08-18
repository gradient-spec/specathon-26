import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LogOut, RefreshCcw, Shield, Wifi, WifiOff, Upload, CreditCard } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "./AuthContext";
import { deleteTeams } from "@/services/admin";
import { supabase } from "@/services/supabase";
import ConfirmDialog from "./ConfirmDialog";
import ShortlistImport from "./ShortlistImport";
import PaymentDashboard from "./PaymentDashboard";
import SpinWheelDashboard from "./SpinWheelDashboard";

type View = "registrations" | "import" | "payments" | "spinwheel";

export default function Dashboard() {
  const { email, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);
  const [view, setView] = useState<View>("import");
  // Timestamp bumped after every successful CSV import.
  // PaymentDashboard watches this to re-fetch automatically.
  const [lastImport, setLastImport] = useState(0);

  // Coalesce burst reloads (a team + its members insert ≈ 3 events within ms).
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setLastLoaded(new Date());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load registrations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const scheduleLoad = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      load();
    }, 400);
  }, [load]);

  // Initial load + safety poll (network hiccups, socket drops).
  useEffect(() => {
    load();
    const id = window.setInterval(load, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  // Realtime subscription — instant updates on insert / update / delete.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("admin-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, scheduleLoad)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, scheduleLoad)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      client.removeChannel(channel);
    };
  }, [scheduleLoad]);

  // Refresh whenever the tab regains focus — matches "open the dashboard, see fresh data".
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  const doDelete = async () => {
    if (!confirm) return;
    try {
      await deleteTeams(confirm.ids, email);
      toast.success(`Deleted ${confirm.ids.length} team${confirm.ids.length === 1 ? "" : "s"}.`);
      setSelected(selected.filter((id) => !confirm.ids.includes(id)));
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setConfirm(null);
    }
  };

  return (
    <div className="min-h-screen bg-void text-fg">
      <Toaster theme="dark" position="top-right" richColors closeButton />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-void/85 backdrop-blur-xl">
        <div className="mx-auto max-w-[1400px] px-6 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-plasma/15 border border-plasma/30 flex items-center justify-center">
              <Shield size={14} className="text-plasma" />
            </div>
            <div>
              <div className="eyebrow">SPECATHON · Admin</div>
              <div className="font-display text-sm tracking-widest">Dashboard</div>
            </div>
            {/* View tabs */}
            <div className="hidden md:flex items-center gap-1 ml-4 rounded-lg border border-line bg-panel/40 p-1">
              <button
                onClick={() => setView("registrations")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "registrations"
                  ? "bg-plasma/20 border border-plasma/30 text-fg"
                  : "text-muted hover:text-fg"
                  }`}
              >
                Registrations
              </button>
              <button
                onClick={() => setView("import")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "import"
                  ? "bg-plasma/20 border border-plasma/30 text-fg"
                  : "text-muted hover:text-fg"
                  }`}
              >
                <Upload size={11} />
                Import Shortlist
              </button>
              <button
                onClick={() => setView("payments")}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "payments"
                  ? "bg-plasma/20 border border-plasma/30 text-fg"
                  : "text-muted hover:text-fg"
                  }`}
              >
                <CreditCard size={11} />
                Payments
              </button>
              <button
                onClick={() => setView("spinwheel")}
                className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all "}
              >
                Spin Wheel
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              title={live ? "Live updates connected" : "Reconnecting…"}
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.24em] ${live ? "text-lumen" : "text-muted"
                }`}
            >
              {live ? <Wifi size={11} /> : <WifiOff size={11} />}
              {live ? "live" : "offline"}
            </span>
            {lastLoaded && (
              <span className="hidden md:inline text-[11px] font-mono text-muted tabular-nums">
                {lastLoaded.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={load}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] text-xs hover:border-white/25 disabled:opacity-50"
            >
              <RefreshCcw size={12} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <span className="hidden md:inline text-xs text-muted">{email}</span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] text-xs hover:border-ember/40 hover:text-ember"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 md:px-8 py-10 space-y-10">
        {/* Mobile tab switcher */}
        <div className="flex md:hidden items-center gap-1 rounded-lg border border-line bg-panel/40 p-1 w-fit">
          <button
            onClick={() => setView("registrations")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "registrations"
              ? "bg-plasma/20 border border-plasma/30 text-fg"
              : "text-muted hover:text-fg"
              }`}
          >
            Registrations
          </button>
          <button
            onClick={() => setView("import")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "import"
              ? "bg-plasma/20 border border-plasma/30 text-fg"
              : "text-muted hover:text-fg"
              }`}
          >
            <Upload size={11} />
            Import
          </button>
          <button
            onClick={() => setView("payments")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === "payments"
              ? "bg-plasma/20 border border-plasma/30 text-fg"
              : "text-muted hover:text-fg"
              }`}
          >
            <CreditCard size={11} />
                Payments
              </button>
              <button
                onClick={() => setView("spinwheel")}
                className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all "}
              >
                Spin Wheel
              </button>
        </div>

        {view === "import" ? (
          <ShortlistImport onImported={() => setLastImport(Date.now())} />
        ) : view === "payments" ? (
          <PaymentDashboard lastImport={lastImport} />
        ) : view === "spinwheel" ? (
          <SpinWheelDashboard />
        ) : loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={22} className="animate-spin text-plasma" />
          </div>
        ) : null}
      </main>

      

      <ConfirmDialog
        open={!!confirm}
        destructive
        title={`Delete ${confirm?.ids.length ?? 0} registration${confirm?.ids.length === 1 ? "" : "s"}?`}
        description="This is permanent and also removes all team members. An entry will be added to the audit log."
        confirmLabel="Delete"
        onConfirm={doDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}








