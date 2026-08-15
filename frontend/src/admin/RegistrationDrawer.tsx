import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Copy, Printer, Save, Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import type { FullTeam } from "@/services/admin";
import { getFullTeam, updateTeamNotes, updateTeamStatus, getAbstractDownloadUrl } from "@/services/admin";
import { STATUS_OPTIONS, type Status } from "@/utils/constants";
import { StatusPill } from "./RegistrationsTable";
import { useAuth } from "./AuthContext";

export default function RegistrationDrawer({
  id,
  onClose,
  onUpdated,
}: {
  id: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const { email, session } = useAuth();
  const [team, setTeam] = useState<FullTeam | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [abstractBusy, setAbstractBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!id) {
      setTeam(null);
      return;
    }
    setBusy(true);
    getFullTeam(id)
      .then((t) => {
        if (!alive) return;
        setTeam(t);
        setNotes(t.notes ?? "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load team"))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const saveNotes = async () => {
    if (!team) return;
    setBusy(true);
    try {
      await updateTeamNotes(team.id, notes, email);
      toast.success("Notes saved.");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (s: Status) => {
    if (!team) return;
    setBusy(true);
    try {
      await updateTeamStatus(team.id, s, email);
      setTeam({ ...team, status: s });
      toast.success(`Marked ${s}.`);
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const viewAbstract = async () => {
    if (!team?.reg_code) return;
    if (!session?.access_token) {
      toast.error("You must be signed in to view abstracts.");
      return;
    }
    setAbstractBusy(true);
    try {
      const url = await getAbstractDownloadUrl(team.reg_code, session.access_token);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate download link.");
    } finally {
      setAbstractBusy(false);
    }
  };

  const copyDetails = async () => {
    if (!team) return;
    const lines = [
      `Team: ${team.team_name}`,
      `Domain: ${team.domain}`,
      `College: ${team.college}${team.college_state ? ` (${team.college_state})` : ""}`,
      `Size: ${team.team_size}`,
      `Leader: ${team.leader_name} · ${team.phone}`,
      team.is_internal ? `Roll ${team.leader_roll} · ${team.leader_year} · ${team.leader_department}` : "",
      "",
      "Members:",
      ...team.members.map(
        (m) =>
          `  · ${m.name} · ${m.phone ?? ""}` +
          (m.roll_number ? ` · ${m.roll_number} · ${m.year} · ${m.department}` : "")
      ),
    ].filter(Boolean);
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Copied to clipboard.");
  };

  return (
    <AnimatePresence>
      {id && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-ink border-l border-line overflow-y-auto"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-ink/95 backdrop-blur border-b border-line">
              <div className="flex items-center gap-3">
                <div className="eyebrow">Registration</div>
                {team && <StatusPill status={team.status} />}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyDetails} title="Copy details" className={iconBtn}>
                  <Copy size={14} />
                </button>
                <button onClick={() => window.print()} title="Print" className={iconBtn}>
                  <Printer size={14} />
                </button>
                <button onClick={onClose} title="Close" className={iconBtn}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {!team ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin text-plasma" />
              </div>
            ) : (
              <div className="p-6 space-y-8">
                <header>
                  <div className="font-mono text-[10px] text-muted uppercase tracking-[0.28em]">
                    ID · {team.id}
                  </div>
                  <h2 className="mt-2 font-display text-3xl tracking-tightest text-fg">
                    {team.team_name}
                  </h2>
                  <div className="mt-2 text-sm text-muted">
                    Registered {new Date(team.created_at).toLocaleString()}
                  </div>
                </header>

                <section>
                  <SectionTitle>Team</SectionTitle>
                  <Grid>
                    <KV k="Domain" v={team.domain} />
                    <KV k="Size" v={String(team.team_size)} />
                    <KV k="College" v={team.college} />
                    {!team.is_internal && <KV k="State" v={team.college_state ?? "—"} />}
                    <KV k="Type" v={team.is_internal ? "St. Peter's" : "External"} />
                  </Grid>
                </section>

                <section>
                  <SectionTitle>Project</SectionTitle>
                  <Grid>
                    <KV k="Title" v={team.project_title ?? "—"} />
                    <KV k="Team ID" v={team.reg_code ?? "—"} />
                  </Grid>
                  {team.abstract_url ? (
                    <div className="mt-4">
                      <button
                        onClick={viewAbstract}
                        disabled={abstractBusy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-lumen/40 bg-lumen/[0.06] text-lumen text-sm hover:bg-lumen/[0.12] hover:border-lumen/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {abstractBusy
                          ? <Loader2 size={14} className="animate-spin" />
                          : <FileDown size={14} />}
                        {abstractBusy ? "Generating secure download link..." : "Open Abstract"}
                      </button>
                      <p className="mt-2 text-[11px] text-muted">
                        Opens a secure download link valid for 10 minutes.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">No abstract uploaded.</p>
                  )}
                </section>

                <section>
                  <SectionTitle>Team leader</SectionTitle>
                  <Grid>
                    <KV k="Name" v={team.leader_name} />
                    <KV k="Phone" v={team.phone} />
                    {team.is_internal && <KV k="Year" v={team.leader_year ?? "—"} />}
                    {team.is_internal && <KV k="Roll number" v={team.leader_roll ?? "—"} />}
                    {team.is_internal && <KV k="Department" v={team.leader_department ?? "—"} />}
                  </Grid>
                </section>

                <section>
                  <SectionTitle>Team members ({team.members.length})</SectionTitle>
                  <div className="space-y-3">
                    {team.members.map((m, i) => (
                      <div key={m.id} className="rounded-xl border border-line p-4 bg-panel/40">
                        <div className="text-[10px] uppercase tracking-[0.24em] text-muted mb-2">
                          Member {i + 2}
                        </div>
                        <Grid>
                          <KV k="Name" v={m.name} />
                          <KV k="Phone" v={m.phone ?? "—"} />
                          {team.is_internal && <KV k="Year" v={m.year ?? "—"} />}
                          {team.is_internal && <KV k="Roll" v={m.roll_number ?? "—"} />}
                          {team.is_internal && <KV k="Dept." v={m.department ?? "—"} />}
                        </Grid>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionTitle>Status</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeStatus(s)}
                        disabled={busy || team.status === s}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${team.status === s
                          ? "border-plasma/50 bg-plasma/10 text-fg"
                          : "border-line text-muted hover:text-fg hover:border-lumen/40"
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <SectionTitle>Organizer notes</SectionTitle>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    className="w-full bg-panel/40 border border-line rounded-lg p-3 text-sm text-fg focus:border-lumen/60 focus:outline-none transition-all focus:shadow-[0_0_0_3px_rgba(47,147,173,0.12),0_0_22px_-6px_rgba(47,147,173,0.5)]"
                    placeholder="Add a private note visible only to organizers…"
                  />
                  <div className="mt-3 flex justify-end">
                    <button onClick={saveNotes} disabled={busy} className="btn-primary disabled:opacity-70">
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save notes
                    </button>
                  </div>
                </section>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

const iconBtn =
  "h-8 w-8 rounded-md border border-line flex items-center justify-center text-fg/70 hover:text-lumen hover:border-lumen/40 transition-colors";

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="eyebrow mb-3 flex items-center gap-3">
    <span className="h-px w-6 bg-line" />
    {children}
  </div>
);
const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
);
const KV = ({ k, v }: { k: string; v: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-[0.24em] text-muted">{k}</div>
    <div className="text-sm text-fg mt-0.5 break-words">{v}</div>
  </div>
);
