import { useMemo } from "react";
import { motion } from "framer-motion";
import type { TeamRow, MemberRow } from "@/services/admin";
import {
  Users, School, Building2, Layers, CalendarClock, CalendarRange,
  Trophy, Percent, Clock4, ChartLine, Sparkles, ShieldCheck,
} from "lucide-react";

type P = { teams: TeamRow[]; members: MemberRow[] };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const sevenDaysAgo = () => Date.now() - 7 * 24 * 60 * 60 * 1000;

export default function StatsGrid({ teams, members }: P) {
  const stats = useMemo(() => {
    const total = teams.length;
    const participants = total + members.length;
    const internal = teams.filter((t) => t.is_internal).length;
    const external = total - internal;
    const colleges = new Set(teams.map((t) => t.college)).size;
    const domains = new Set(teams.map((t) => t.domain)).size;
    const t0 = startOfToday();
    const w0 = sevenDaysAgo();
    const today = teams.filter((t) => new Date(t.created_at).getTime() >= t0).length;
    const week = teams.filter((t) => new Date(t.created_at).getTime() >= w0).length;
    const latest = teams[0];
    const avgSize = total === 0 ? 0 : participants / total;
    const domainMap = new Map<string, number>();
    for (const t of teams) domainMap.set(t.domain, (domainMap.get(t.domain) ?? 0) + 1);
    const topDomain = [...domainMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const internalPct = total === 0 ? 0 : Math.round((internal / total) * 100);

    return { total, participants, internal, external, colleges, domains,
      today, week, latest, avgSize, topDomain, internalPct };
  }, [teams, members]);

  const cards = [
    { icon: Users, label: "Total teams", value: stats.total, tint: "text-plasma" },
    { icon: Users, label: "Total participants", value: stats.participants, tint: "text-lumen" },
    { icon: ShieldCheck, label: "St. Peter's teams", value: stats.internal, tint: "text-gold" },
    { icon: School, label: "Other-college teams", value: stats.external, tint: "text-ember" },
    { icon: Building2, label: "Colleges", value: stats.colleges, tint: "text-plasma" },
    { icon: Layers, label: "Domains selected", value: stats.domains, tint: "text-lumen" },
    { icon: CalendarClock, label: "Today", value: stats.today, tint: "text-gold" },
    { icon: CalendarRange, label: "This week", value: stats.week, tint: "text-plasma" },
    { icon: Sparkles, label: "Avg. team size", value: stats.avgSize.toFixed(1), tint: "text-lumen" },
    { icon: Trophy, label: "Top domain", value: stats.topDomain, tint: "text-gold" },
    { icon: Percent, label: "Internal %", value: `${stats.internalPct}%`, tint: "text-ember" },
    {
      icon: Clock4,
      label: "Latest",
      value: stats.latest ? new Date(stats.latest.created_at).toLocaleString() : "—",
      tint: "text-plasma",
      small: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-2xl glass p-5 overflow-hidden group"
        >
          <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-plasma/20 via-transparent to-lumen/20 blur-xl -z-10" />
          <div className="flex items-center justify-between mb-4">
            <div className={`h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center ${c.tint}`}>
              <c.icon size={14} />
            </div>
            <ChartLine size={12} className="text-muted" />
          </div>
          <div className={`font-mono tracking-tightest text-fg ${c.small ? "text-sm md:text-base" : "text-3xl md:text-4xl"}`}>
            {c.value}
          </div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted">
            {c.label}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
