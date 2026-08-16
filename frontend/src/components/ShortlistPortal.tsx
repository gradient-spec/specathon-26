import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ArrowRight, CheckCircle2, Loader2, AlertTriangle, Users, Ticket,
  Download, CalendarPlus, MapPin, IndianRupee,
} from "lucide-react";
import jsPDF from "jspdf";
import Reveal from "@/components/Reveal";
import FinalistReveal from "@/components/FinalistReveal";
import {
  searchTeam,
  paymentService,
  type MockTeam,
} from "@/services/mockShortlist";

/* Display metadata (domain + members) keyed to the mock teams. The mock's
   `amount` already equals ₹400 × team size, so the on-screen breakdown and the
   charged amount stay in sync. */
const PER_HEAD = 400;
const TEAM_META: Record<string, { domain: string; members: string[] }> = {
  "SPC2026-001": { domain: "AI & Machine Learning", members: ["Sharanya (Lead)", "Kiran R.", "Meghana P.", "Aditya V."] },
  "SPC2026-002": { domain: "Cybersecurity", members: ["Suraj (Lead)", "Nikhil T.", "Farah K.", "Rohan D."] },
  "SPC2026-003": { domain: "Data Science", members: ["Rahul (Lead)", "Sneha", "Varun", "Ishaan"] },
  "SPC2026-004": { domain: "Blockchain", members: ["Priya (Lead)", "Aman", "Divya", "Karthik"] },
  "SPC2026-005": { domain: "Data Science", members: ["Arjun (Lead)", "Lakshmi", "Yash", "Tara"] },
};
const DEADLINE_LABEL = "August 31, 2026";
const VENUE = "St. Peter's Engineering College, Hyderabad · Gate 2";

type View =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "not_found" }
  | { kind: "not_eligible"; team: MockTeam }
  | { kind: "shortlisted"; team: MockTeam }
  | { kind: "paying"; team: MockTeam }
  | { kind: "confirmed"; team: MockTeam; txnId: string };

function metaFor(team: MockTeam) {
  return TEAM_META[team.team_id] ?? { domain: "Open Innovation", members: [team.team_lead + " (Lead)"] };
}

export default function ShortlistPortal() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>({ kind: "idle" });
  const [celebrate, setCelebrate] = useState<{ show: boolean; teamName?: string }>({ show: false });

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setView({ kind: "searching" });
    // Small delay to feel like a lookup.
    window.setTimeout(() => {
      const team = searchTeam(query);
      if (!team) return setView({ kind: "not_found" });
      if (team.shortlist_status !== "shortlisted") return setView({ kind: "not_eligible", team });
      if (team.payment_status === "paid") {
        return setView({ kind: "confirmed", team, txnId: team.transaction_id ?? "—" });
      }
      // Finalist discovered — fire the celebration reveal.
      setView({ kind: "shortlisted", team });
      setCelebrate({ show: true, teamName: team.team_name });
    }, 550);
  };

  const pay = (team: MockTeam) => {
    setView({ kind: "paying", team });
    window.setTimeout(() => {
      const res = paymentService.completeSuccess(team.mock_token);
      if (res.ok) {
        setView({ kind: "confirmed", team: res.team, txnId: res.transactionId });
      } else {
        // Already paid or edge case — reflect the current state.
        const fresh = searchTeam(team.mock_token);
        if (fresh && fresh.payment_status === "paid") {
          setView({ kind: "confirmed", team: fresh, txnId: fresh.transaction_id ?? "—" });
        } else {
          setView({ kind: "shortlisted", team });
        }
      }
    }, 1100);
  };

  return (
    <section id="shortlist-portal" className="relative py-8 md:py-10 scroll-mt-20">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-6">
            {/* <div className="eyebrow inline-flex items-center gap-2 mb-4">
              <ShieldCheck size={12} className="text-lumen" />
              Seat Confirmation Hub
            </div> */}
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Verify your <span className="text-lumen">Shortlist Status</span>
            </h2>
            <p className="mt-4 text-subtle text-sm md:text-base">
              Search with your Team Leader Email, Team Name, or Team ID to confirm your seat before the {DEADLINE_LABEL} deadline.
            </p>
          </div>
        </Reveal>

        {/* Search */}
        <Reveal delay={0.08}>
          <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Team Leader Email, Team Name, or Team ID"
                className="field !pl-11"
                aria-label="Search shortlist"
              />
            </div>
            <button type="submit" className="btn-primary shrink-0 justify-center">
              Search Status
              <ArrowRight size={16} />
            </button>
          </form>
          <p className="mt-3 text-center text-[11px] font-mono text-muted">
            Try: <button type="button" onClick={() => setQuery("alpha@example.com")} className="text-lumen hover:underline">alpha@example.com</button>
            {" · "}
            <button type="button" onClick={() => setQuery("Team Nova")} className="text-lumen hover:underline">Team Nova</button> (paid)
          </p>
        </Reveal>

        {/* Result */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            {view.kind === "searching" && (
              <Panel key="searching">
                <div className="flex items-center justify-center gap-3 py-6 text-subtle">
                  <Loader2 size={18} className="animate-spin text-lumen" /> Looking up your team…
                </div>
              </Panel>
            )}

            {view.kind === "not_found" && (
              <Panel key="nf" tone="warn">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-gold mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-fg">We couldn't find that team</div>
                    <p className="mt-1 text-sm text-subtle">
                      Double-check your spelling, or reach the support desk:
                      {" "}<a href="mailto:support@specathon.dev" className="text-lumen hover:underline">support@specathon.dev</a>.
                      Student leads: M Anusha (President) · G Shubhang (Admin).
                    </p>
                  </div>
                </div>
              </Panel>
            )}

            {view.kind === "not_eligible" && (
              <Panel key="ne" tone="warn">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="text-gold mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium text-fg">
                      {view.team.team_name} — {view.team.shortlist_status === "waitlisted" ? "Waitlisted" : "Not selected this round"}
                    </div>
                    <p className="mt-1 text-sm text-subtle">
                      Hang tight — waitlist movement is communicated by email. Questions?
                      {" "}<a href="mailto:support@specathon.dev" className="text-lumen hover:underline">support@specathon.dev</a>.
                    </p>
                  </div>
                </div>
              </Panel>
            )}

            {(view.kind === "shortlisted" || view.kind === "paying") && (
              <ShortlistedCard
                key="sl"
                team={view.team}
                paying={view.kind === "paying"}
                onPay={() => pay(view.team)}
              />
            )}

            {view.kind === "confirmed" && (
              <ConfirmedPass key="cf" team={view.team} txnId={view.txnId} />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Non-confetti celebration on finalist reveal */}
      <FinalistReveal
        show={celebrate.show}
        teamName={celebrate.teamName}
        onDone={() => setCelebrate((s) => ({ ...s, show: false }))}
      />
    </section>
  );
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl glass p-6 ${tone === "warn" ? "border-gold/30" : ""}`}
    >
      {children}
    </motion.div>
  );
}

/* ── State A: Shortlisted (pending payment) ─────────────────────────── */
function ShortlistedCard({ team, paying, onPay }: { team: MockTeam; paying: boolean; onPay: () => void }) {
  const meta = metaFor(team);
  const heads = meta.members.length;
  const fee = PER_HEAD * heads;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl glass p-6 md:p-8"
    >
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-success">
          <CheckCircle2 size={12} /> Shortlisted
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-gold">
          Payment Pending
        </div>
      </div>

      <h3 className="mt-5 font-display text-2xl md:text-3xl tracking-tight">{team.team_name}</h3>
      <div className="mt-1 text-sm text-subtle">{meta.domain} · {team.team_id}</div>

      <div className="mt-6 grid sm:grid-cols-2 gap-5">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-1.5"><Users size={11} /> Team Members</div>
          <ul className="space-y-1 text-sm text-fg/90">
            {meta.members.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-panel/40 p-4">
          <div className="eyebrow mb-2">Fee Breakdown</div>
          <div className="flex items-center justify-between text-sm text-subtle">
            <span>₹{PER_HEAD} × {heads} members</span>
            <span className="font-mono text-fg">₹{fee}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-line flex items-center justify-between">
            <span className="text-sm text-subtle">Total due</span>
            <span className="font-mono text-2xl text-fg inline-flex items-center"><IndianRupee size={18} />{fee}</span>
          </div>
          <div className="mt-2 text-[11px] text-muted">Deadline · {DEADLINE_LABEL}</div>
        </div>
      </div>

      <button
        onClick={onPay}
        disabled={paying}
        className="btn-primary w-full justify-center mt-7 disabled:opacity-70 text-base !py-3.5"
      >
        {paying ? <><Loader2 size={16} className="animate-spin" /> Processing payment…</> : <>Proceed to Pay & Lock Seat</>}
      </button>
    </motion.div>
  );
}

/* ── State B: Confirmed → Module 3 QR Entry Pass ────────────────────── */
function ConfirmedPass({ team, txnId }: { team: MockTeam; txnId: string }) {
  const meta = metaFor(team);
  const qrPayload = useMemo(
    () => `SPECATHON2026|${team.team_id}|${team.team_name}|${txnId}`,
    [team, txnId]
  );
  const qrUrl =
    `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&bgcolor=1A2332&color=2F93AD&data=${encodeURIComponent(qrPayload)}`;

  const gcalUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${encodeURIComponent("SPECATHON 2026 — Hackathon")}` +
    "&dates=20260911T030000Z/20260912T120000Z" +
    `&location=${encodeURIComponent("St. Peter's Engineering College, Hyderabad")}` +
    `&details=${encodeURIComponent(`Team ${team.team_name} confirmed. Report at Gate 2. Txn: ${txnId}`)}`;

  const savePass = () => {
    const doc = new jsPDF({ unit: "pt", format: "a5" });
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(11, 15, 20);
    doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), "F");
    doc.setTextColor(47, 147, 173);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("SPECATHON 2026", 32, 56);
    doc.setTextColor(237, 237, 237);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Official Entry Pass · Gradient Club", 32, 74);
    let y = 116;
    const line = (k: string, v: string) => {
      doc.setTextColor(130, 149, 128);
      doc.text(k.toUpperCase(), 32, y);
      doc.setTextColor(237, 237, 237);
      doc.setFontSize(13);
      doc.text(v, 32, y + 16);
      doc.setFontSize(11);
      y += 44;
    };
    line("Team", `${team.team_name}  (${team.team_id})`);
    line("Track", meta.domain);
    line("Members", meta.members.join(", "));
    line("Venue", VENUE);
    line("Transaction", txnId);
    doc.setTextColor(205, 130, 0);
    doc.text("Show this pass + QR at Gate 2 for check-in.", 32, y + 6);
    doc.save(`SPECATHON2026_Pass_${team.team_id}.pdf`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Confirmation banner */}
      <div className="rounded-2xl border border-success/30 bg-success/[0.08] p-4 mb-6 flex items-center gap-3">
        <CheckCircle2 size={18} className="text-success shrink-0" />
        <div className="text-sm">
          <span className="text-fg font-medium">Seat confirmed.</span>
          <span className="text-subtle"> Your digital entry pass is ready. Txn {txnId}.</span>
        </div>
      </div>

      {/* Module 3 — QR Entry Pass */}
      <div className="relative rounded-3xl overflow-hidden border border-line bg-panel/60 backdrop-blur-xl">
        <div className="absolute inset-0 bg-radial opacity-60 pointer-events-none" />
        <div className="relative grid md:grid-cols-[1.4fr_1fr]">
          {/* Left — details */}
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-lumen">
              <Ticket size={16} />
              <span className="font-mono text-[11px] uppercase tracking-[0.28em]">Digital Entry Pass</span>
            </div>
            <div className="mt-4 font-display font-bold text-3xl tracking-tightest">SPECATHON 2026</div>
            <div className="mt-1 text-sm text-subtle">36-Hour National Level Hackathon · Sept 11–12</div>

            <div className="mt-6 space-y-3 text-sm">
              <Row k="Team" v={`${team.team_name} · ${team.team_id}`} />
              <Row k="Track" v={meta.domain} />
              <Row k="Members" v={meta.members.join(", ")} />
              <Row k="Venue" v={VENUE} icon={<MapPin size={13} className="text-lumen" />} />
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button onClick={savePass} className="btn-primary">
                <Download size={15} /> Save Official Pass
              </button>
              <a href={gcalUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                <CalendarPlus size={15} /> Add to Google Calendar
              </a>
            </div>
          </div>

          {/* Right — QR */}
          <div className="flex flex-col items-center justify-center gap-3 p-6 md:p-8 border-t md:border-t-0 md:border-l border-line bg-void/40">
            <img
              src={qrUrl}
              alt="Entry QR code"
              width={180}
              height={180}
              className="rounded-xl border border-line bg-panel"
            />
            <div className="text-[11px] font-mono uppercase tracking-[0.24em] text-muted text-center">
              Scan at Gate 2
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Row({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-muted pt-1">{k}</span>
      <span className="flex items-start gap-1.5 text-fg/90">{icon}{v}</span>
    </div>
  );
}
