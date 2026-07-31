import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, AlertCircle, ShieldCheck, Users,
  CreditCard, ChevronRight, X, CheckCircle2, XCircle, Cpu,
} from "lucide-react";
import Navbar  from "@/components/Navbar";
import Footer  from "@/components/Footer";
import Reveal  from "@/components/Reveal";
import {
  validateTeam,
  createPaymentOrder,
  submitPaymentCallback,
  type ValidatedTeam,
  type PaymentOrder,
} from "@/services/v2";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PageState =
  | { phase: "loading" }
  | { phase: "error";   message: string }
  | { phase: "ready";   team: ValidatedTeam }
  | { phase: "ordering" }
  | { phase: "dialog";  team: ValidatedTeam; provider: string; order: PaymentOrder }
  | { phase: "callback" };

// ─────────────────────────────────────────────────────────────────────────────
// Payment Page
// ─────────────────────────────────────────────────────────────────────────────

export default function Payment() {
  const [params]          = useSearchParams();
  const navigate          = useNavigate();
  const teamId            = params.get("team")?.trim() ?? "";
  const [state, setState] = useState<PageState>({ phase: "loading" });

  // Validate team on mount
  useEffect(() => {
    if (!teamId) {
      setState({ phase: "error", message: "No Team ID provided. Please go back and select your team." });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const team = await validateTeam(teamId);
        if (!cancelled) setState({ phase: "ready", team });
      } catch (err) {
        if (!cancelled) setState({
          phase: "error",
          message: err instanceof Error ? err.message : "Failed to validate team.",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  // Create order and open provider dialog
  const handlePay = async () => {
    if (state.phase !== "ready") return;
    const team = state.team;
    setState({ phase: "ordering" });
    try {
      const { provider, order } = await createPaymentOrder(teamId);
      setState({ phase: "dialog", team, provider, order });
    } catch (err) {
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to create payment order.",
      });
    }
  };

  // Called by the provider dialog after success / failure
  const handleCallbackDone = (status: "success" | "failure") => {
    navigate(`/payment/result?status=${status}&team=${encodeURIComponent(teamId)}`);
  };

  const handleCancel = () => {
    // Return to ready state so user can retry
    if (state.phase === "dialog") {
      setState({ phase: "ready", team: state.team });
    }
  };

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-2xl px-6 md:px-10 pt-28 pb-20">
        <AnimatePresence mode="wait">

          {/* Loading */}
          {state.phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-4"
            >
              <Loader2 size={28} className="animate-spin text-lumen" />
              <p className="text-sm text-muted font-mono uppercase tracking-[0.24em]">
                Verifying team…
              </p>
            </motion.div>
          )}

          {/* Error */}
          {state.phase === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-24 text-center"
            >
              <div className="h-14 w-14 rounded-2xl border border-ember/30 bg-ember/[0.08] flex items-center justify-center">
                <AlertCircle size={24} className="text-ember" />
              </div>
              <div>
                <h2 className="font-display text-xl tracking-tight text-fg">Something went wrong</h2>
                <p className="mt-2 text-sm text-muted max-w-sm">{state.message}</p>
              </div>
              <button
                onClick={() => navigate("/shortlisted")}
                className="btn-primary"
              >
                Back to Shortlisted Teams
              </button>
            </motion.div>
          )}

          {/* Ready — show team info + pay button */}
          {(state.phase === "ready" || state.phase === "ordering") && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <Reveal>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-4">
                    <ShieldCheck size={11} />
                    Team Verified
                  </div>
                  <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tightest">
                    Complete Your Registration
                  </h1>
                  <p className="mt-3 text-muted text-sm">
                    Review your details and pay the registration fee to secure your spot.
                  </p>
                </div>
              </Reveal>

              {/* Team details card */}
              <Reveal delay={0.06}>
                <div className="rounded-2xl glass p-6 space-y-4">
                  <div className="eyebrow flex items-center gap-2">
                    <Users size={11} />
                    Team Details
                  </div>

                  {state.phase === "ready" && (
                    <dl className="space-y-3">
                      {[
                        { label: "Team ID",    value: state.team.team_id,        mono: true  },
                        { label: "Team Name",  value: state.team.team_name,       mono: false },
                        { label: "Team Lead",  value: state.team.team_lead_name,  mono: false },
                        { label: "Team Size",  value: `${state.team.team_size} members`, mono: false },
                      ].map(({ label, value, mono }) => (
                        <div key={label} className="flex items-center justify-between gap-4 py-2 border-b border-line last:border-0">
                          <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono shrink-0">
                            {label}
                          </dt>
                          <dd className={`text-sm text-fg text-right ${mono ? "font-mono text-lumen tracking-wider" : "font-medium"}`}>
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </Reveal>

              {/* Amount card */}
              <Reveal delay={0.1}>
                <div className="rounded-2xl border border-lumen/20 bg-lumen/[0.04] p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow mb-1 flex items-center gap-2">
                        <CreditCard size={11} />
                        Registration Fee
                      </div>
                      <p className="text-xs text-muted mt-1">
                        One-time payment · Non-refundable
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-bold text-3xl text-lumen tracking-tight">
                        ₹{state.phase === "ready" ? state.team.amount.toLocaleString("en-IN") : "—"}
                      </div>
                      <div className="text-xs text-muted mt-0.5">INR</div>
                    </div>
                  </div>
                </div>
              </Reveal>

              {/* Pay button */}
              <Reveal delay={0.14}>
                <button
                  onClick={handlePay}
                  disabled={state.phase !== "ready"}
                  className="btn-primary w-full justify-center text-base py-4 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {state.phase === "ordering" ? (
                    <><Loader2 size={16} className="animate-spin" /> Creating order…</>
                  ) : (
                    <>Pay Registration Fee <ChevronRight size={16} /></>
                  )}
                </button>
                <p className="text-center text-xs text-muted mt-3">
                  Secured payment · You will be prompted to confirm before payment is processed
                </p>
              </Reveal>
            </motion.div>
          )}

          {/* Callback in progress */}
          {state.phase === "callback" && (
            <motion.div
              key="callback"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 gap-4"
            >
              <Loader2 size={28} className="animate-spin text-lumen" />
              <p className="text-sm text-muted font-mono uppercase tracking-[0.24em]">
                Processing payment…
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Dummy Payment Dialog — rendered outside main flow, above everything */}
      <AnimatePresence>
        {state.phase === "dialog" && (
          <DummyPaymentDialog
            team={state.team}
            provider={state.provider}
            order={state.order}
            onSuccess={async () => {
              setState({ phase: "callback" });
              try {
                await submitPaymentCallback({
                  orderId:   state.order.id,
                  paymentId: `dummy_payment_${randomHex(8)}`,
                  status:    "SUCCESS",
                });
                handleCallbackDone("success");
              } catch {
                handleCallbackDone("success"); // navigate regardless — result page handles edge cases
              }
            }}
            onFailure={async () => {
              setState({ phase: "callback" });
              try {
                await submitPaymentCallback({
                  orderId:   state.order.id,
                  paymentId: `dummy_payment_${randomHex(8)}`,
                  status:    "FAILED",
                });
                handleCallbackDone("failure");
              } catch {
                handleCallbackDone("failure");
              }
            }}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>

      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dummy Payment Dialog
// ─────────────────────────────────────────────────────────────────────────────

function DummyPaymentDialog({
  team,
  provider,
  order,
  onSuccess,
  onFailure,
  onCancel,
}: {
  team:      ValidatedTeam;
  provider:  string;
  order:     PaymentOrder;
  onSuccess: () => void;
  onFailure: () => void;
  onCancel:  () => void;
}) {
  const [busy, setBusy] = useState(false);
  const cancelRef       = useRef<HTMLButtonElement>(null);

  // Trap focus: close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const handle = async (fn: () => void) => {
    if (busy) return;
    setBusy(true);
    fn();
    // busy stays true — page transitions away
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dummy-dialog-title"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-void/80 backdrop-blur-md"
        onClick={() => !busy && onCancel()}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1,    y: 0  }}
        exit={{   opacity: 0, scale: 0.96,  y: 12 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-md rounded-3xl glass border border-lumen/20 p-7 shadow-[0_0_60px_-12px_rgba(74,203,235,0.3)]"
      >
        {/* Close button */}
        <button
          ref={cancelRef}
          onClick={() => !busy && onCancel()}
          disabled={busy}
          aria-label="Cancel payment"
          className="absolute top-5 right-5 h-7 w-7 rounded-lg border border-line flex items-center justify-center text-muted hover:text-fg hover:border-lumen/40 transition-colors disabled:opacity-40"
        >
          <X size={13} />
        </button>

        {/* Provider badge */}
        <div className="flex items-center gap-2 mb-6">
          <div className="h-9 w-9 rounded-xl border border-lumen/30 bg-lumen/10 flex items-center justify-center">
            <Cpu size={16} className="text-lumen" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.24em] text-lumen">
              {provider.toUpperCase()} PROVIDER
            </div>
            <div className="text-[10px] text-muted mt-0.5">Simulated payment gateway</div>
          </div>
        </div>

        {/* Payment summary */}
        <h2
          id="dummy-dialog-title"
          className="font-display font-bold text-xl tracking-tight mb-5"
        >
          Confirm Payment
        </h2>

        <dl className="space-y-3 mb-6">
          {[
            { label: "Team",     value: team.team_name           },
            { label: "Order ID", value: order.id, mono: true     },
            { label: "Currency", value: order.currency           },
          ].map(({ label, value, mono }) => (
            <div key={label} className="flex items-center justify-between border-b border-line pb-3 last:border-0 last:pb-0">
              <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono">{label}</dt>
              <dd className={`text-sm text-fg text-right ${mono ? "font-mono text-lumen/80 text-xs" : "font-medium"}`}>
                {value}
              </dd>
            </div>
          ))}
          {/* Amount gets its own prominent row */}
          <div className="flex items-center justify-between pt-1">
            <dt className="text-xs text-muted uppercase tracking-[0.18em] font-mono">Amount</dt>
            <dd className="font-display font-bold text-2xl text-lumen">
              ₹{order.amount.toLocaleString("en-IN")}
            </dd>
          </div>
        </dl>

        {/* Action buttons */}
        <div className="space-y-3">
          {/* Success */}
          <button
            onClick={() => handle(onSuccess)}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-medium bg-lumen/15 border border-lumen/40 text-lumen hover:bg-lumen/25 hover:border-lumen/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Pay Successfully
          </button>

          {/* Failure */}
          <button
            onClick={() => handle(onFailure)}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium border border-ember/30 text-ember/80 hover:bg-ember/[0.08] hover:border-ember/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle size={14} />
            Simulate Failure
          </button>

          {/* Cancel */}
          <button
            onClick={() => !busy && onCancel()}
            disabled={busy}
            className="w-full text-xs text-muted hover:text-fg transition-colors py-2 disabled:opacity-40"
          >
            Cancel — return to payment details
          </button>
        </div>

        {/* Dev note */}
        <p className="mt-5 text-[10px] text-muted/60 text-center leading-relaxed">
          This is a simulated payment gateway used during development.
          Real payment processing will be enabled before launch.
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
