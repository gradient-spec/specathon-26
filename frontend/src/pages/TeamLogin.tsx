import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Users, LogIn, Eye, EyeOff } from "lucide-react";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { Turnstile } from "@marsidev/react-turnstile";

export default function TeamLogin() {
  const { signInTeam, session, isTeam, teamId, loading } = useTeamAuth();
  const nav = useNavigate();
  const [teamIdInput, setTeamIdInput] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // If already logged in as a team, redirect to their shortlist dashboard
  if (!loading && session && isTeam && teamId) {
    return <Navigate to={`/team/payment`} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (!turnstileToken) throw new Error("Please complete the security check.");
      await signInTeam(teamIdInput.trim(), password, turnstileToken);
      // Wait for session state to update naturally, but we can preemptively route:
      nav(`/team/payment`, { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed. Please check your Team ID and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-void px-6 noise overflow-hidden">
      <div className="absolute inset-0 bg-grid [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] pointer-events-none" />
      <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-plasma/20 blur-[120px] pointer-events-none animate-float" />
      <div className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-lumen/10 blur-[120px] pointer-events-none animate-float [animation-delay:2s]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md glass rounded-2xl p-8 md:p-10"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-lg bg-lumen/15 border border-lumen/30 flex items-center justify-center">
            <Users size={16} className="text-lumen" />
          </div>
          <div>
            <div className="eyebrow">SPECATHON  Team Portal</div>
            <div className="font-display text-2xl tracking-tightest">Team Login</div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <label className="block">
            <span className="eyebrow mb-2 block">Team ID</span>
            <input
              required
              type="text"
              autoComplete="username"
              value={teamIdInput}
              onChange={(e) => setTeamIdInput(e.target.value.toUpperCase())}
              className="field"
              placeholder="SPEC2026-0001"
            />
          </label>

          <label className="block">
            <span className="eyebrow mb-2 block">Password</span>
            <div className="relative">
              <input
                required
                type={show ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field pr-11"
                placeholder="        "
              />
                        <div className="flex justify-center mt-2">
            <Turnstile siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} />
          </div>
          <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md flex items-center justify-center text-muted hover:text-fg transition-colors"
              >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>

          {err && (
            <div className="rounded-lg border border-ember/40 bg-ember/[0.08] p-3 text-sm text-ember">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full justify-center disabled:opacity-70"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {busy ? "Authenticating" : "Continue"}
          </button>
        </form>

      </motion.div>
    </div>
  );
}


