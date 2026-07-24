import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import type { TeamRow } from "@/services/admin";

const COLORS = ["#4ACBEB", "#186275", "#CD8200", "#1A9E4A", "#7B5FC0", "#5BE8B6", "#4A90C4", "#AD0D03", "#E0A83C"];

const cardCls = "rounded-2xl glass p-5";

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className={cardCls}>
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <div className="font-display text-base tracking-tight text-fg">{title}</div>
          {sub && <div className="eyebrow mt-1">{sub}</div>}
        </div>
      </div>
      <div className="h-[260px]">{children}</div>
    </div>
  );
}

const tooltip = {
  contentStyle: {
    background: "#121820",
    border: "1px solid #2A3647",
    borderRadius: 10,
    color: "#EDEDED",
    fontSize: 12,
  },
  cursor: { fill: "rgba(74,203,235,0.06)" },
};

export default function Charts({ teams }: { teams: TeamRow[] }) {
  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of teams) {
      const d = new Date(t.created_at).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date: date.slice(5), count }));
  }, [teams]);

  const perDomain = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of teams) map.set(t.domain, (map.get(t.domain) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [teams]);

  const perSize = useMemo(() => {
    const map = new Map<number, number>();
    for (const t of teams) map.set(t.team_size, (map.get(t.team_size) ?? 0) + 1);
    return [2, 3, 4].map((n) => ({ size: `${n}`, count: map.get(n) ?? 0 }));
  }, [teams]);

  const perCollege = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of teams) map.set(t.college, (map.get(t.college) ?? 0) + 1);
    return [...map.entries()]
      .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 20) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [teams]);

  const internalVsExternal = useMemo(() => {
    const internal = teams.filter((t) => t.is_internal).length;
    const external = teams.length - internal;
    return [
      { name: "St. Peter's", value: internal },
      { name: "Others", value: external },
    ];
  }, [teams]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Registrations per day" sub="Trend since launch">
        <ResponsiveContainer>
          <LineChart data={perDay} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(42, 54, 71, 0.4)" vertical={false} />
            <XAxis dataKey="date" stroke="#829580" fontSize={11} />
            <YAxis stroke="#829580" fontSize={11} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Line type="monotone" dataKey="count" stroke="#4ACBEB" strokeWidth={2} dot={{ fill: "#186275", r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Participants per domain" sub="Team count by track">
        <ResponsiveContainer>
          <BarChart data={perDomain} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(42, 54, 71, 0.4)" vertical={false} />
            <XAxis dataKey="name" stroke="#829580" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis stroke="#829580" fontSize={11} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Bar dataKey="value" fill="#186275" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Team size distribution" sub="2 · 3 · 4">
        <ResponsiveContainer>
          <BarChart data={perSize} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="rgba(42, 54, 71, 0.4)" vertical={false} />
            <XAxis dataKey="size" stroke="#829580" fontSize={11} />
            <YAxis stroke="#829580" fontSize={11} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Bar dataKey="count" fill="#4ACBEB" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Internal vs External" sub="Share of registrations">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={internalVsExternal}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={4}
            >
              <Cell fill="#186275" stroke="none" />
              <Cell fill="#4ACBEB" stroke="none" />
            </Pie>
            <Tooltip {...tooltip} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard title="College-wise registrations" sub="Top 8 by team count">
          <ResponsiveContainer>
            <BarChart data={perCollege} layout="vertical" margin={{ left: 0, right: 20, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(42, 54, 71, 0.4)" horizontal={false} />
              <XAxis type="number" stroke="#829580" fontSize={11} allowDecimals={false} />
              <YAxis dataKey="name" type="category" stroke="#829580" fontSize={11} width={160} />
              <Tooltip {...tooltip} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {perCollege.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
