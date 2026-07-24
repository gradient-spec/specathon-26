import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Eye, Trash2, ChevronLeft, ChevronRight, Search, ArrowUpDown,
} from "lucide-react";
import type { TeamRow } from "@/services/admin";
import { DOMAIN_OPTIONS, STATUS_OPTIONS, type Status } from "@/utils/constants";

const PAGE_SIZE = 12;

type SortKey = "created_at" | "team_name" | "team_size" | "domain" | "college" | "status";

export type Filters = {
  q: string;
  domain: string;
  college: string;
  size: string;
  status: string;
  origin: "" | "internal" | "external";
  from: string;
  to: string;
};

export const emptyFilters: Filters = {
  q: "", domain: "", college: "", size: "", status: "", origin: "", from: "", to: "",
};

export function applyFilters(rows: TeamRow[], f: Filters): TeamRow[] {
  const q = f.q.trim().toLowerCase();
  return rows.filter((t) => {
    if (q) {
      const hay = [
        t.team_name, t.leader_name, t.phone, t.leader_roll ?? "", t.college,
      ].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.domain && t.domain !== f.domain) return false;
    if (f.college && t.college !== f.college) return false;
    if (f.size && String(t.team_size) !== f.size) return false;
    if (f.status && t.status !== f.status) return false;
    if (f.origin === "internal" && !t.is_internal) return false;
    if (f.origin === "external" && t.is_internal) return false;
    if (f.from && new Date(t.created_at) < new Date(f.from)) return false;
    if (f.to) {
      const toEnd = new Date(f.to);
      toEnd.setHours(23, 59, 59, 999);
      if (new Date(t.created_at) > toEnd) return false;
    }
    return true;
  });
}

export default function RegistrationsTable({
  teams,
  filters,
  setFilters,
  selected,
  setSelected,
  onView,
  onDelete,
}: {
  teams: TeamRow[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  selected: string[];
  setSelected: (ids: string[]) => void;
  onView: (id: string) => void;
  onDelete: (ids: string[]) => void;
}) {
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "created_at",
    dir: "desc",
  });

  const filtered = useMemo(() => applyFilters(teams, filters), [teams, filters]);
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sort.key] as unknown;
      const bv = b[sort.key] as unknown;
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.includes(r.id));

  const toggleAllOnPage = () => {
    if (allOnPageSelected) {
      setSelected(selected.filter((id) => !pageRows.some((r) => r.id === id)));
    } else {
      const add = pageRows.map((r) => r.id).filter((id) => !selected.includes(id));
      setSelected([...selected, ...add]);
    }
  };

  const toggleOne = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const colleges = useMemo(
    () => [...new Set(teams.map((t) => t.college))].sort(),
    [teams]
  );

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }))}
      className="inline-flex items-center gap-1.5 hover:text-fg transition-colors"
    >
      {label}
      <ArrowUpDown size={11} className={sort.key === key ? "text-lumen" : "opacity-40"} />
    </button>
  );

  return (
    <div className="rounded-2xl glass overflow-hidden">
      {/* Filters row */}
      <div className="p-4 md:p-5 flex flex-wrap gap-3 items-center border-b border-line">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            placeholder="Search team, leader, phone, roll, college…"
            className="w-full pl-9 pr-3 py-2.5 bg-panel/40 border border-line rounded-lg text-sm text-fg focus:border-lumen/60 focus:outline-none"
          />
        </div>
        <select value={filters.domain} onChange={(e) => setFilters({ ...filters, domain: e.target.value })} className={selCls}>
          <option value="" className="bg-ink">All domains</option>
          {DOMAIN_OPTIONS.map((d) => <option key={d} value={d} className="bg-ink">{d}</option>)}
        </select>
        <select value={filters.college} onChange={(e) => setFilters({ ...filters, college: e.target.value })} className={selCls}>
          <option value="" className="bg-ink">All colleges</option>
          {colleges.map((c) => <option key={c} value={c} className="bg-ink">{c}</option>)}
        </select>
        <select value={filters.size} onChange={(e) => setFilters({ ...filters, size: e.target.value })} className={selCls}>
          <option value="" className="bg-ink">Any size</option>
          {[2, 3, 4].map((n) => <option key={n} value={n} className="bg-ink">{n} members</option>)}
        </select>
        <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className={selCls}>
          <option value="" className="bg-ink">Any status</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-ink">{s}</option>)}
        </select>
        <select value={filters.origin} onChange={(e) => setFilters({ ...filters, origin: e.target.value as Filters["origin"] })} className={selCls}>
          <option value="" className="bg-ink">Internal + External</option>
          <option value="internal" className="bg-ink">Internal only</option>
          <option value="external" className="bg-ink">External only</option>
        </select>
        <div className="flex items-center gap-2 text-xs text-muted">
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={selCls} />
          <span>→</span>
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={selCls} />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="px-4 md:px-5 py-3 bg-plasma/[0.06] border-b border-plasma/20 flex items-center justify-between">
          <span className="text-sm text-fg">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(selected)}
              className="text-xs px-3 py-1.5 rounded-lg border border-ember/40 text-ember hover:bg-ember/10"
            >
              Delete selected
            </button>
            <button
              onClick={() => setSelected([])}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-muted hover:text-fg"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-[10px] uppercase tracking-[0.2em] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left w-8">
                <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} className="accent-plasma" />
              </th>
              <th className="px-4 py-3 text-left">{sortBtn("team_name", "Team")}</th>
              <th className="px-4 py-3 text-left">{sortBtn("team_size", "Size")}</th>
              <th className="px-4 py-3 text-left">{sortBtn("domain", "Domain")}</th>
              <th className="px-4 py-3 text-left">{sortBtn("college", "College")}</th>
              <th className="px-4 py-3 text-left">{sortBtn("created_at", "Registered")}</th>
              <th className="px-4 py-3 text-left">{sortBtn("status", "Status")}</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-muted text-sm">
                  No registrations match the current filters.
                </td>
              </tr>
            )}
            {pageRows.map((t) => (
              <motion.tr
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border-b border-line hover:bg-panel/20"
              >
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleOne(t.id)} className="accent-plasma" />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-fg">{t.team_name}</div>
                  <div className="text-xs text-muted mt-0.5">{t.leader_name} · {t.phone}</div>
                </td>
                <td className="px-4 py-3 tabular-nums">{t.team_size}</td>
                <td className="px-4 py-3">{t.domain}</td>
                <td className="px-4 py-3">
                  <div>{t.college}</div>
                  {!t.is_internal && t.college_state && (
                    <div className="text-xs text-muted mt-0.5">{t.college_state}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-muted tabular-nums text-xs">
                  <div>{new Date(t.created_at).toLocaleDateString()}</div>
                  <div>{new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button
                      onClick={() => onView(t.id)}
                      aria-label="View"
                      className="h-8 w-8 rounded-md border border-line flex items-center justify-center text-fg/70 hover:text-lumen hover:border-lumen/40"
                    >
                      <Eye size={13} />
                    </button>
                    <button
                      onClick={() => onDelete([t.id])}
                      aria-label="Delete"
                      className="h-8 w-8 rounded-md border border-line flex items-center justify-center text-fg/70 hover:text-ember hover:border-ember/40"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 md:px-5 py-3 flex items-center justify-between border-t border-line text-xs text-muted">
        <div>
          Showing {sorted.length === 0 ? 0 : page * PAGE_SIZE + 1}
          –{Math.min(sorted.length, (page + 1) * PAGE_SIZE)} of {sorted.length}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="h-7 w-7 rounded-md border border-line flex items-center justify-center disabled:opacity-40 hover:border-lumen/40"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="px-2 tabular-nums">
            {page + 1} / {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page + 1 >= pageCount}
            className="h-7 w-7 rounded-md border border-line flex items-center justify-center disabled:opacity-40 hover:border-lumen/40"
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, string> = {
    pending: "border-gold/40 text-gold bg-gold/[0.06]",
    verified: "border-lumen/40 text-lumen bg-lumen/[0.06]",
    approved: "border-success/40 text-success bg-success/[0.06]",
    rejected: "border-ember/40 text-ember bg-ember/[0.08]",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] uppercase tracking-wider ${map[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

const selCls =
  "bg-panel/40 border border-line rounded-lg px-3 py-2 text-xs text-fg focus:border-lumen/60 focus:outline-none";
