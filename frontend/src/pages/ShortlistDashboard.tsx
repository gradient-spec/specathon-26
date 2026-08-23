import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { mockShortlistService, type MockTeam } from "@/services/mockShortlist";

type TeamLoadState =
  | { phase: "loading" }
  | { phase: "error" }
  | { phase: "ready"; team: MockTeam };

function formatDeadline(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

export default function ShortlistDashboard() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<TeamLoadState>({ phase: "loading" });

  useEffect(() => {
    const team = mockShortlistService.getTeamForToken(token ?? "");
    if (!team) {
      navigate("/shortlist/invalid", { replace: true });
      return;
    }
    setState({ phase: "ready", team });
  }, [navigate, token]);

  if (state.phase === "loading") {
    return (
      <div className="min-h-screen bg-void text-fg flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-lumen/30 bg-lumen/[0.08]">
              <ShieldCheck className="text-lumen" size={20} />
            </div>
            <p className="mt-6 text-sm font-mono uppercase tracking-[0.28em] text-muted">Verifying access</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (state.phase === "error") {
    return null;
  }

  const { team } = state;
  const isShortlisted = team.shortlist_status === "shortlisted";
  const deadline = formatDeadline(team.payment_deadline);
  const hasDeadlinePassed = new Date(team.payment_deadline) < new Date();

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-4xl px-6 md:px-10 pt-28 pb-20">
        <Reveal>
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <Trophy size={11} />
              SPECATHON 2026
            </div>
            <h1 className="font-display text-4xl md:text-5xl tracking-tightest">
              {isShortlisted ? "🎉 YOU'RE SHORTLISTED!" : team.shortlist_status === "waitlisted" ? "You are on the waitlist" : "Thank you for participating"}
            </h1>
          </div>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-line bg-panel/30 p-6 md:p-8">
              <p className="text-xs font-mono uppercase tracking-[0.28em] text-muted">Private Team Portal</p>

              {isShortlisted && (
                <div className="mt-6 space-y-2">
                  <p className="text-2xl font-display">Congratulations, {team.team_name}.</p>
                </div>
              )}

              {team.shortlist_status === "not_selected" && (
                <div className="mt-6 space-y-3">
                  <p className="text-xl font-display">Thank you for participating in SPECATHON 2026.</p>
                  <p className="text-muted">Your team was not shortlisted for this round.</p>
                </div>
              )}

              {team.shortlist_status === "waitlisted" && (
                <div className="mt-6 space-y-3">
                  <p className="text-xl font-display">Your team is currently waitlisted.</p>
                  <p className="text-muted">We will contact you if a slot becomes available.</p>
                </div>
              )}

              <dl className="mt-8 space-y-4">
                <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                  <dt className="text-xs font-mono uppercase tracking-[0.24em] text-muted">Team ID</dt>
                  <dd className="font-mono text-sm text-lumen">{team.team_id}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                  <dt className="text-xs font-mono uppercase tracking-[0.24em] text-muted">Team Name</dt>
                  <dd className="text-sm text-fg">{team.team_name}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                  <dt className="text-xs font-mono uppercase tracking-[0.24em] text-muted">Team Lead</dt>
                  <dd className="text-sm text-fg">{team.team_lead}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
                  <dt className="text-xs font-mono uppercase tracking-[0.24em] text-muted">Payment Status</dt>
                  <dd className="text-sm text-fg">{team.payment_status === "paid" ? "PAID" : team.payment_status === "pending" ? "PENDING" : "FAILED"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4 pb-1">
                  <dt className="text-xs font-mono uppercase tracking-[0.24em] text-muted">Payment Deadline</dt>
                  <dd className="text-sm text-fg">{deadline}</dd>
                </div>
              </dl>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <aside className="rounded-2xl border border-line bg-panel/20 p-6 h-fit">
              <div className="eyebrow mb-4 flex items-center gap-2">
                <ShieldCheck size={12} />
                Your Status
              </div>

              <StatusList team={team} />

              {team.shortlist_status === "shortlisted" && (
                <div className="mt-8 space-y-4">
                  <div className="rounded-xl border border-lumen/20 bg-lumen/[0.05] p-4">
                    <div className="text-xs font-mono uppercase tracking-[0.2em] text-muted">Participation Fee</div>
                    <div className="mt-2 text-3xl font-display text-lumen">₹{team.amount.toLocaleString("en-IN")}</div>
                  </div>

                  {team.payment_status === "pending" && !hasDeadlinePassed && (
                    <button
                      type="button"
                      onClick={() => navigate(`/shortlist/${encodeURIComponent(team.mock_token)}/payment`)}
                      className="btn-primary w-full justify-center"
                    >
                      Pay Registration Fee
                      <ArrowRight size={16} />
                    </button>
                  )}

                  {team.payment_status === "paid" && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/shortlist/${encodeURIComponent(team.mock_token)}/receipt`)}
                        className="btn-secondary w-full justify-center"
                      >
                        <Download size={16} />
                        Download Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/shortlist/${encodeURIComponent(team.mock_token)}/receipt`)}
                        className="btn-ghost w-full justify-center"
                      >
                        View Payment Details
                      </button>
                    </div>
                  )}

                  {team.payment_status === "pending" && hasDeadlinePassed && (
                    <div className="rounded-xl border border-ember/20 bg-ember/[0.04] p-4 text-sm text-muted">
                      <div className="flex items-start gap-2 text-ember">
                        <AlertCircle size={16} />
                        <span>Payment Window Closed</span>
                      </div>
                      <p className="mt-2 text-fg/80">The payment deadline for this shortlist offer has passed.</p>
                    </div>
                  )}
                </div>
              )}
            </aside>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function StatusList({ team }: { team: MockTeam }) {
  const shortlistCompleted = team.shortlist_status === "shortlisted";
  const paymentCompleted = team.payment_status === "paid";

  const statuses = [
    { label: "Registration Submitted", done: true },
    { label: "Team Shortlisted", done: shortlistCompleted },
    { label: "Payment Pending", done: paymentCompleted ? false : team.payment_status === "pending" && team.shortlist_status === "shortlisted" },
    { label: "Participation Confirmed", done: paymentCompleted },
  ];

  return (
    <div className="space-y-3 text-sm text-fg/90">
      {statuses.map((item) => {
        const isComplete = item.done;
        const Icon = isComplete ? CheckCircle2 : Circle;
        return (
          <div key={item.label} className="flex items-center gap-3">
            <Icon size={16} className={isComplete ? "text-lumen" : "text-muted"} />
            <span className={isComplete ? "text-fg" : "text-muted"}>{isComplete ? item.label : item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
