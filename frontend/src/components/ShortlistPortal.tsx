import { forwardRef, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, CheckCircle2, Loader2, Users, Ticket,
  Download, CalendarPlus, MapPin, IndianRupee, Lock, Timer,
} from "lucide-react";
import jsPDF from "jspdf";
import ShortlistTerminal from "@/components/ShortlistTerminal";
import {
  searchTeam,
  paymentService,
  type MockTeam,
} from "@/services/mockShortlist";
import type { ShortlistedTeam } from "@/services/v2";
import { useTeamAuth } from "@/hooks/TeamAuthContext";

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
  | { kind: "shortlisted"; team: MockTeam }
  | { kind: "paying"; team: MockTeam }
  | { kind: "confirmed"; team: MockTeam; txnId: string };

function metaFor(team: MockTeam) {
  return TEAM_META[team.team_id] ?? { domain: "Open Innovation", members: [team.team_lead + " (Lead)"] };
}

export default function ShortlistPortal() {
  const [view, setView] = useState<View>({ kind: "idle" });
  const navigate = useNavigate();
  const { teamId: authenticatedTeamId, signOutTeam } = useTeamAuth();

  // Handed off from ShortlistTerminal once the verification reveal's CTA is
  // clicked. The public search no longer has access to payment_status (it's
  // not exposed by the real shortlisted-teams data source), so every
  // confirmed seat routes to Team Login — payment state is only known once
  // the team authenticates.
  //
  // BUG FIX: the "currently authenticated team" and the "currently
  // searched/selected team" are different concepts and must never be
  // conflated. TeamLogin redirects an already-authenticated session
  // straight to /team/payment without re-checking which team was just
  // searched — so if a user is still signed in as e.g. TEST-002, searches
  // for TEST-003, and clicks "Confirm Your Seat", navigating to
  // /team/login alone would silently reuse the stale TEST-002 session
  // instead of prompting for TEST-003. Sign out that stale session first
  // whenever the selected team differs from the authenticated one, so the
  // login form always applies to the team the user just selected.
  const onConfirmSeat = async (team: ShortlistedTeam) => {
    if (authenticatedTeamId && authenticatedTeamId !== team.team_id) {
      await signOutTeam(); // performs its own redirect to /team/login
      return;
    }
    navigate("/team/login", { state: { teamId: team.team_id } });
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
    <section id="shortlist-portal" className="relative py-12 md:py-10 scroll-mt-20">
      <div className="mx-auto px-6 md:px-10">
        {/* Verification widget — search, live "database check", congrats reveal */}
        <ShortlistTerminal onConfirmSeat={onConfirmSeat} />

        {/* Hand-off result — existing payment / QR-pass flow, unchanged */}
        <div className="mt-6 max-w-3xl mx-auto">
          <AnimatePresence initial={false} mode="popLayout">
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
    </section>
  );
}

/* ── State A: Shortlisted (pending payment) — premium reservation card ── */
const RESERVATION_HOLD_MS = 24 * 60 * 60 * 1000;
const SEATS_TOTAL = 990;
const SEATS_RESERVED = 912;

const ShortlistedCard = forwardRef<HTMLDivElement, { team: MockTeam; paying: boolean; onPay: () => void }>(
function ShortlistedCard({ team, paying, onPay }, ref) {
  const meta = metaFor(team);
  const heads = meta.members.length;
  const fee = PER_HEAD * heads;

  // Local 24h reservation-hold countdown, fixed the moment this card mounts.
  const [holdExpiry] = useState(() => Date.now() + RESERVATION_HOLD_MS);
  const [remaining, setRemaining] = useState(() => Math.max(0, holdExpiry - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, holdExpiry - Date.now())), 1000);
    return () => clearInterval(id);
  }, [holdExpiry]);
  const hh = String(Math.floor(remaining / 3_600_000)).padStart(2, "0");
  const mm = String(Math.floor((remaining % 3_600_000) / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0");
  const seatPct = Math.round((SEATS_RESERVED / SEATS_TOTAL) * 100);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-[26px] bg-slate-900/80 backdrop-blur-xl border border-cyan-500/40 p-6 md:p-9 overflow-hidden shadow-[0_0_25px_rgba(0,242,254,0.08)]"
    >
      {/* faint ambient glow */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-400">
          <CheckCircle2 size={12} /> Shortlisted
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.2em] text-cyan-400">
          Payment Pending
        </div>
      </div>

      {/* Premium headline */}
      <h3 className="relative mt-6 font-display font-bold text-3xl md:text-4xl tracking-tight text-white">
        Reserve{" "}
        <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #00F2FE, #10B981)" }}>
          Your Spot
        </span>
      </h3>
      <p className="relative mt-2 max-w-md text-sm md:text-[15px] text-slate-400 font-light leading-relaxed">
        Your team's slot is provisionally held. Complete seat confirmation and payment to lock in your pass.
      </p>

      <div className="relative mt-6 pt-5 border-t border-slate-800">
        <div className="font-display text-xl md:text-2xl tracking-tight text-fg">{team.team_name}</div>
        <div className="mt-1 text-sm text-subtle">{meta.domain} · {team.team_id}</div>
      </div>

      <div className="relative mt-6 grid sm:grid-cols-2 gap-5">
        <div>
          <div className="eyebrow mb-2 flex items-center gap-1.5"><Users size={11} /> Team Members</div>
          <ul className="space-y-1 text-sm text-fg/90">
            {meta.members.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="eyebrow mb-2">Fee Breakdown</div>
          <div className="flex items-center justify-between text-sm text-subtle">
            <span>₹{PER_HEAD} × {heads} members</span>
            <span className="font-mono text-fg">₹{fee}</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-sm text-subtle">Total due</span>
            <span className="font-mono text-2xl text-fg inline-flex items-center"><IndianRupee size={18} />{fee}</span>
          </div>
          <div className="mt-2 text-[11px] text-muted">Deadline · {DEADLINE_LABEL}</div>
        </div>
      </div>

      {/* Primary CTA — cyan-to-emerald gradient with pulsing glow */}
      <button
        onClick={onPay}
        disabled={paying}
        className="cta-shimmer-cyan relative w-full mt-8 rounded-full px-6 py-4 text-base font-bold flex items-center justify-center gap-2 text-slate-950 disabled:opacity-70 transition-transform active:scale-[0.99] bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400"
      >
        {paying ? (
          <><Loader2 size={16} className="animate-spin" /> Processing payment…</>
        ) : (
          <>Proceed to Payment &amp; Confirm Seat <ArrowRight size={16} /></>
        )}
      </button>

      {/* Urgency indicators */}
      <div className="relative mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.06] px-2.5 py-1 text-cyan-400 font-mono text-sm">
          <Timer size={12} /> Slot held for {hh}:{mm}:{ss}
        </div>
        <div className="flex items-center gap-2 sm:w-40">
          <div className="h-1 flex-1 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
              style={{ width: `${seatPct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-slate-500 shrink-0">{SEATS_RESERVED}/{SEATS_TOTAL}</span>
        </div>
      </div>
      <div className="relative mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
        <Lock size={10} /> Secure checkout · seat held until timer expires
      </div>
    </motion.div>
  );
});

/* ── State B: Confirmed → Module 3 QR Entry Pass ────────────────────── */
const ConfirmedPass = forwardRef<HTMLDivElement, { team: MockTeam; txnId: string }>(
function ConfirmedPass({ team, txnId }, ref) {
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
      ref={ref}
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
});

function Row({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-muted pt-1">{k}</span>
      <span className="flex items-start gap-1.5 text-fg/90">{icon}{v}</span>
    </div>
  );
}
