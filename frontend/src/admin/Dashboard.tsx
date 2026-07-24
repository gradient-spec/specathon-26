import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LogOut, RefreshCcw, Shield, Wifi, WifiOff } from "lucide-react";
import { Toaster, toast } from "sonner";
import { useAuth } from "./AuthContext";
import { deleteTeams, listMembersFor, listTeams, type MemberRow, type TeamRow } from "@/services/admin";
import { supabase } from "@/services/supabase";
import StatsGrid from "./StatsGrid";
import Charts from "./Charts";
import RegistrationsTable, { applyFilters, emptyFilters, type Filters } from "./RegistrationsTable";
import RegistrationDrawer from "./RegistrationDrawer";
import ExportBar from "./ExportBar";
import ConfirmDialog from "./ConfirmDialog";

export default function Dashboard() {
  const { email, signOut } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);
  const [live, setLive] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);

  // Coalesce burst reloads (a team + its members insert ≈ 3 events within ms).
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await listTeams();
      const m = await listMembersFor(rows.map((r) => r.id));
      setTeams(rows);
      setMembers(m);
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

  const filteredForExport = applyFilters(teams, filters);

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
          </div>

          <div className="flex items-center gap-3">
            <span
              title={live ? "Live updates connected" : "Reconnecting…"}
              className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-[0.24em] ${
                live ? "text-lumen" : "text-muted"
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
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={22} className="animate-spin text-plasma" />
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-end justify-between flex-wrap gap-4 mb-6">
                <div>
                  <div className="eyebrow">Overview</div>
                  <h1 className="font-display text-3xl md:text-4xl tracking-tightest mt-2">
                    {teams.length} team{teams.length === 1 ? "" : "s"} registered
                  </h1>
                </div>
                <ExportBar rows={filteredForExport} />
              </div>
              <StatsGrid teams={teams} members={members} />
            </section>

            <section>
              <div className="eyebrow mb-4">Analytics</div>
              <Charts teams={teams} />
            </section>

            <section>
              <div className="eyebrow mb-4">Registrations</div>
              <RegistrationsTable
                teams={teams}
                filters={filters}
                setFilters={setFilters}
                selected={selected}
                setSelected={setSelected}
                onView={setViewId}
                onDelete={(ids) => setConfirm({ ids })}
              />
            </section>
          </>
        )}
      </main>

      <RegistrationDrawer id={viewId} onClose={() => setViewId(null)} onUpdated={load} />

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
