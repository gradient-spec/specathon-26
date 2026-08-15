import { useState } from "react";
import { Download, ChevronDown, FileSpreadsheet, FileText, FileType2, Archive, Loader2, LayoutGrid } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import type { FullTeam } from "@/services/admin";
import { listMembersFor, downloadAllAbstracts } from "@/services/admin";
import { supabase } from "@/services/supabase";
import type { TeamRow } from "@/services/admin";
import {
  exportAllCsv, exportAllPdf, exportAllXlsx,
  exportOthersCsv, exportOthersPdf, exportOthersXlsx,
  exportStPetersCsv, exportStPetersPdf, exportStPetersXlsx,
  exportDomainXlsx,
} from "@/utils/exports";
import { useAuth } from "./AuthContext";

type Scope = "spec" | "others" | "all";

async function fetchFull(rows: TeamRow[]): Promise<FullTeam[]> {
  const members = await listMembersFor(rows.map((r) => r.id));
  const byTeam = new Map<string, FullTeam["members"]>();
  for (const m of members) {
    const list = byTeam.get(m.team_id) ?? [];
    list.push(m);
    byTeam.set(m.team_id, list);
  }
  return rows.map((r) => ({ ...r, members: byTeam.get(r.id) ?? [] }));
}

export default function ExportBar({ rows }: { rows: TeamRow[] }) {
  const { session } = useAuth();
  const [open, setOpen] = useState<Scope | null>(null);
  const [busy, setBusy] = useState(false);
  const [abstractBusy, setAbstractBusy] = useState(false);
  const [abstractProgress, setAbstractProgress] = useState<{ done: number; total: number } | null>(null);
  const [domainBusy, setDomainBusy] = useState(false);

  const run = async (scope: Scope, format: "xlsx" | "csv" | "pdf") => {
    if (!supabase) return;
    try {
      setBusy(true);
      const STPETERS = "St. Peter's Engineering College";
      const isSpec = (r: TeamRow) => r.is_internal || r.college === STPETERS;
      const scoped =
        scope === "spec" ? rows.filter(isSpec) :
          scope === "others" ? rows.filter((r) => !isSpec(r)) :
            rows;
      if (scoped.length === 0) {
        toast.info("Nothing to export in the current filter.");
        return;
      }
      const full = await fetchFull(scoped);
      if (scope === "spec") {
        if (format === "xlsx") exportStPetersXlsx(full);
        if (format === "csv") exportStPetersCsv(full);
        if (format === "pdf") exportStPetersPdf(full);
      } else if (scope === "others") {
        if (format === "xlsx") exportOthersXlsx(full);
        if (format === "csv") exportOthersCsv(full);
        if (format === "pdf") exportOthersPdf(full);
      } else {
        if (format === "xlsx") exportAllXlsx(full);
        if (format === "csv") exportAllCsv(full);
        if (format === "pdf") exportAllPdf(full);
      }
      toast.success(`Exported ${scoped.length} team${scoped.length === 1 ? "" : "s"} as ${format.toUpperCase()}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
      setOpen(null);
    }
  };

  const downloadDomainExport = async () => {
    const token = session?.access_token;
    if (!token) { toast.error("You must be signed in to export."); return; }
    if (rows.length === 0) { toast.info("Nothing to export."); return; }

    setDomainBusy(true);
    try {
      const full = await fetchFull(rows);

      // Resolve presigned abstract URLs (concurrency-limited, failures silently skipped)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const edgeUrl = `${supabaseUrl}/functions/v1/get-abstract-url`;
      const withAbstract = full.filter((t) => t.abstract_url && t.reg_code);
      const urlMap = new Map<string, string>();
      const CONCURRENCY = 5;

      for (let i = 0; i < withAbstract.length; i += CONCURRENCY) {
        const batch = withAbstract.slice(i, i + CONCURRENCY);
        await Promise.allSettled(
          batch.map(async (team) => {
            try {
              const res = await fetch(edgeUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({ teamId: team.reg_code }),
              });
              const body = await res.json() as { success: boolean; signedUrl?: string };
              if (res.ok && body.success && body.signedUrl) {
                urlMap.set(team.reg_code!, body.signedUrl);
              }
            } catch { /* silently skip — row still exports without link */ }
          })
        );
      }

      exportDomainXlsx(full, urlMap);
      toast.success(`Exported ${full.length} team${full.length === 1 ? "" : "s"} grouped by domain.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Domain export failed.");
    } finally {
      setDomainBusy(false);
    }
  };

  const downloadAbstracts = async () => {
    const token = session?.access_token;
    if (!token) {
      toast.error("You must be signed in to download abstracts.");
      return;
    }
    const withAbstract = rows.filter((t) => t.abstract_url && t.reg_code);
    if (withAbstract.length === 0) {
      toast.info("No abstracts found in the current view.");
      return;
    }
    setAbstractBusy(true);
    setAbstractProgress({ done: 0, total: withAbstract.length });
    try {
      await downloadAllAbstracts(rows, token, (done, total) => {
        setAbstractProgress({ done, total });
      });
      toast.success(`Downloaded ${withAbstract.length} abstract${withAbstract.length === 1 ? "" : "s"} as ZIP.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Abstract download failed.");
    } finally {
      setAbstractBusy(false);
      setAbstractProgress(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <ExportButton
        label="St. Peter's"
        onOpen={() => setOpen(open === "spec" ? null : "spec")}
        open={open === "spec"}
        onRun={(f) => run("spec", f)}
        busy={busy || abstractBusy || domainBusy}
      />
      <ExportButton
        label="Other Colleges"
        onOpen={() => setOpen(open === "others" ? null : "others")}
        open={open === "others"}
        onRun={(f) => run("others", f)}
        busy={busy || abstractBusy || domainBusy}
      />
      <ExportButton
        label="All Registrations"
        primary
        onOpen={() => setOpen(open === "all" ? null : "all")}
        open={open === "all"}
        onRun={(f) => run("all", f)}
        busy={busy || abstractBusy || domainBusy}
      />

      {/* Domain-wise XLSX export */}
      <button
        onClick={downloadDomainExport}
        disabled={busy || abstractBusy || domainBusy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-line text-fg hover:border-lumen/40 hover:bg-lumen/[0.04] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export team list grouped by domain with abstract links"
      >
        {domainBusy
          ? <Loader2 size={13} className="animate-spin" />
          : <LayoutGrid size={13} />}
        {domainBusy ? "Exporting…" : "Domain Export"}
      </button>

      {/* Bulk abstract download */}
      <button
        onClick={downloadAbstracts}
        disabled={busy || abstractBusy}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-lumen/40 text-lumen hover:bg-lumen/[0.06] hover:border-lumen/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        title="Download all uploaded abstracts as a ZIP"
      >
        {abstractBusy
          ? <Loader2 size={13} className="animate-spin" />
          : <Archive size={13} />}
        {abstractBusy && abstractProgress
          ? `Downloading ${abstractProgress.done}/${abstractProgress.total}…`
          : "Download All Abstracts"}
      </button>
    </div>
  );
}

function ExportButton({
  label,
  onOpen,
  open,
  onRun,
  busy,
  primary,
}: {
  label: string;
  onOpen: () => void;
  open: boolean;
  onRun: (f: "xlsx" | "csv" | "pdf") => void;
  busy: boolean;
  primary?: boolean;
}) {
  return (
    <div className="relative">
      <button
        onClick={onOpen}
        disabled={busy}
        className={
          primary
            ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-plasma border border-plasma/30 text-fg hover:border-lumen/50 hover:shadow-[0_0_16px_rgba(47,147,173,0.3)] transition-all disabled:opacity-50"
            : "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border border-line text-fg hover:border-lumen/40 hover:bg-lumen/[0.04] transition-all disabled:opacity-50"
        }
      >
        <Download size={13} />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-30 right-0 mt-2 w-44 rounded-xl border border-line bg-ink shadow-xl overflow-hidden"
          >
            <MenuItem icon={<FileSpreadsheet size={13} />} label="Excel (.xlsx)" onClick={() => onRun("xlsx")} />
            <MenuItem icon={<FileText size={13} />} label="CSV" onClick={() => onRun("csv")} />
            <MenuItem icon={<FileType2 size={13} />} label="PDF" onClick={() => onRun("pdf")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm hover:bg-panel/60 transition-colors">
      <span className="text-lumen">{icon}</span>
      {label}
    </button>
  );
}
