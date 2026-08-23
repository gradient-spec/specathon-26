import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { mockShortlistService, paymentService, type MockTeam } from "@/services/mockShortlist";

type LoadState =
  | { phase: "loading" }
  | { phase: "ready"; team: MockTeam }
  | { phase: "error"; message: string };

export default function ShortlistPayment() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [method, setMethod] = useState("UPI");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const team = mockShortlistService.getTeamForToken(token ?? "");
    if (!team) {
      navigate("/shortlist/invalid", { replace: true });
      return;
    }
    if (team.shortlist_status !== "shortlisted") {
      navigate(`/shortlist/${encodeURIComponent(team.mock_token)}`, { replace: true });
      return;
    }
    if (team.payment_status === "paid") {
      navigate(`/shortlist/${encodeURIComponent(team.mock_token)}/confirmation?status=success`, { replace: true });
      return;
    }
    setState({ phase: "ready", team });
  }, [navigate, token]);

  const handleSimulate = async (mode: "success" | "failure") => {
    setBusy(true);

    const created = paymentService.createPayment(token);
    if (!created.ok) {
      setBusy(false);
      if (created.code === "invalid_token") {
        navigate("/shortlist/invalid", { replace: true });
        return;
      }
      if (created.code === "deadline_expired") {
        navigate(`/shortlist/${encodeURIComponent(token)}`, { replace: true });
        return;
      }
      if (created.code === "already_paid") {
        navigate(`/shortlist/${encodeURIComponent(token)}/confirmation?status=success`, { replace: true });
        return;
      }
      setState({ phase: "error", message: "This payment could not be processed right now." });
      return;
    }

    const result = mode === "success" ? paymentService.completeSuccess(token) : paymentService.completeFailure(token);

    if (!result.ok) {
      setBusy(false);
      if (result.code === "invalid_token") {
        navigate("/shortlist/invalid", { replace: true });
        return;
      }
      if (result.code === "already_paid") {
        navigate(`/shortlist/${encodeURIComponent(token)}/confirmation?status=success`, { replace: true });
        return;
      }
      setState({ phase: "error", message: "This payment could not be processed right now." });
      return;
    }

    const next = mode === "success" ? "success" : "failure";
    const tx = mode === "success" && "transactionId" in result ? result.transactionId : "";
    setBusy(false);
    navigate(`/shortlist/${encodeURIComponent(token)}/confirmation?status=${next}&tx=${encodeURIComponent(tx)}`);
  };

  if (state.phase === "loading") {
    return <LoadingShell />;
  }

  if (state.phase === "error") {
    return (
      <div className="min-h-screen bg-void text-fg flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <div className="w-full max-w-md rounded-2xl border border-ember/20 bg-ember/[0.03] p-8 text-center">
            <AlertCircle className="mx-auto text-ember" size={26} />
            <h1 className="mt-4 font-display text-3xl">Payment unavailable</h1>
            <p className="mt-3 text-muted">{state.message}</p>
            <button type="button" onClick={() => navigate(`/shortlist/${encodeURIComponent(token)}`)} className="btn-primary mt-6">Return to Team Dashboard</button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const team = state.team;
  const paymentEligible = team.payment_status === "pending" && new Date(team.payment_deadline) >= new Date();

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-2xl px-6 md:px-10 pt-28 pb-20">
        <Reveal>
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <ShieldCheck size={11} />
              Mock Payment Gateway
            </div>
            <h1 className="font-display text-3xl md:text-4xl tracking-tightest">Registration Payment</h1>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-line bg-panel/20 p-6 md:p-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <div className="eyebrow mb-2">Team</div>
                <p className="text-xl font-display">{team.team_name}</p>
                <p className="mt-2 text-sm text-muted">{team.team_id}</p>
              </div>
              <div className="text-left md:text-right">
                <div className="eyebrow mb-2">Amount</div>
                <p className="text-3xl font-display text-lumen">₹{team.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <p className="eyebrow mb-4">Payment Method</p>
              <div className="space-y-3">
                {['UPI', 'Card', 'Net Banking'].map((item) => (
                  <label key={item} className="flex items-center gap-3 rounded-xl border border-line bg-panel/20 px-4 py-3 text-sm cursor-pointer hover:border-lumen/40">
                    <input
                      type="radio"
                      name="payment-method"
                      checked={method === item}
                      onChange={() => setMethod(item)}
                      className="accent-lumen"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => handleSimulate("success")} disabled={busy || !paymentEligible} className="btn-primary flex-1 justify-center disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin" /> : "Simulate Successful Payment"}
              </button>
              <button type="button" onClick={() => handleSimulate("failure")} disabled={busy || !paymentEligible} className="btn-ghost flex-1 justify-center disabled:opacity-50">
                Simulate Failed Payment
              </button>
            </div>

            <button type="button" onClick={() => navigate(`/shortlist/${encodeURIComponent(team.mock_token)}`)} className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
              <ArrowLeft size={15} />
              Cancel
            </button>

            {!paymentEligible && (
              <div className="mt-6 rounded-xl border border-ember/20 bg-ember/[0.04] p-4 text-sm text-muted">
                <div className="flex items-center gap-2 text-ember"><AlertCircle size={16} /> Payment window closed.</div>
              </div>
            )}
          </div>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}

function LoadingShell() {
  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={26} className="animate-spin text-lumen" />
          <p className="text-xs font-mono uppercase tracking-[0.28em] text-muted">Preparing payment</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
