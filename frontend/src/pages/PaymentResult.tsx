import { useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, Home, ArrowRight, RotateCcw, Users } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// ─────────────────────────────────────────────────────────────────────────────
// PaymentResult — /payment/result?status=success|failure&team=SPEC2026-xxxx
// Purely presentational. Reads URL params only. No API calls.
// ─────────────────────────────────────────────────────────────────────────────

export default function PaymentResult() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();

  const status = params.get("status")?.toLowerCase().trim();
  const teamId = params.get("team")?.trim() ?? "";

  // Guard — unknown status values redirect immediately
  useEffect(() => {
    if (status !== "success" && status !== "failure") {
      navigate("/shortlisted", { replace: true });
    }
  }, [status, navigate]);

  if (status !== "success" && status !== "failure") return null;

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md text-center"
        >
          {status === "success"
            ? <SuccessState teamId={teamId} />
            : <FailureState teamId={teamId} />
          }
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}

// ── Success ───────────────────────────────────────────────────────────────────

function SuccessState({ teamId }: { teamId: string }) {
  return (
    <div className="space-y-8">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
        className="mx-auto h-20 w-20 rounded-3xl border border-lumen/30 bg-lumen/[0.08]
                   flex items-center justify-center
                   shadow-[0_0_40px_-8px_rgba(47,147,173,0.45)]"
      >
        <CheckCircle2 size={36} className="text-lumen" />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tightest">
          Payment Successful
        </h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
          Registration fee received successfully.
          Thank you for completing your payment.
        </p>
        {teamId && (
          <div className="inline-flex items-center gap-2 rounded-full border border-lumen/20
                          bg-lumen/[0.05] px-4 py-1.5 text-xs font-mono text-lumen
                          tracking-wider mt-2">
            {teamId}
          </div>
        )}
      </motion.div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="rounded-2xl glass border border-lumen/15 p-5 text-left space-y-2"
      >
        <p className="text-xs text-muted uppercase tracking-[0.2em] font-mono mb-3">
          What's next
        </p>
        {[
          "You will receive a confirmation shortly.",
          "Venue details and schedule will be shared before the event.",
          "Keep your Team ID handy for check-in at the venue.",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-sm text-fg/80">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-lumen/60 shrink-0" />
            {item}
          </div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.36 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3"
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line
                     text-sm text-muted hover:text-fg hover:border-lumen/40 transition-colors"
        >
          <Home size={14} />
          Return to Home
        </Link>
        <Link
          to="/shortlisted"
          className="btn-primary"
        >
          View Shortlisted Teams
          <ArrowRight size={14} />
        </Link>
      </motion.div>
    </div>
  );
}

// ── Failure ───────────────────────────────────────────────────────────────────

function FailureState({ teamId }: { teamId: string }) {
  const retryHref = teamId
    ? `/payment?team=${encodeURIComponent(teamId)}`
    : "/shortlisted";

  return (
    <div className="space-y-8">
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1,   opacity: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
        className="mx-auto h-20 w-20 rounded-3xl border border-ember/25 bg-ember/[0.07]
                   flex items-center justify-center"
      >
        <XCircle size={36} className="text-ember" />
      </motion.div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tightest">
          Payment Failed
        </h1>
        <p className="text-muted text-sm leading-relaxed max-w-xs mx-auto">
          Your payment could not be completed.
          No amount has been deducted. You may try again.
        </p>
        {teamId && (
          <div className="inline-flex items-center gap-2 rounded-full border border-ember/20
                          bg-ember/[0.05] px-4 py-1.5 text-xs font-mono text-ember/80
                          tracking-wider mt-2">
            {teamId}
          </div>
        )}
      </motion.div>

      {/* Help card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28 }}
        className="rounded-2xl border border-ember/15 bg-ember/[0.04] p-5 text-left space-y-2"
      >
        <p className="text-xs text-muted uppercase tracking-[0.2em] font-mono mb-3">
          Common reasons
        </p>
        {[
          "Payment was cancelled or timed out.",
          "Insufficient funds or card declined.",
          "Network issue during transaction.",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5 text-sm text-fg/80">
            <span className="mt-1.5 h-1 w-1 rounded-full bg-ember/50 shrink-0" />
            {item}
          </div>
        ))}
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.36 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-3"
      >
        <Link
          to="/shortlisted"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-line
                     text-sm text-muted hover:text-fg hover:border-lumen/40 transition-colors"
        >
          <Users size={14} />
          Return to Shortlisted Teams
        </Link>
        <Link
          to={retryHref}
          className="btn-primary"
        >
          <RotateCcw size={14} />
          Try Again
        </Link>
      </motion.div>
    </div>
  );
}
