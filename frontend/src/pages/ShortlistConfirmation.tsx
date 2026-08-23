import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Download, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { mockShortlistService } from "@/services/mockShortlist";

export default function ShortlistConfirmation() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const status = params.get("status")?.toLowerCase() ?? "success";
  const tx = params.get("tx") ?? "";
  const [team, setTeam] = useState<ReturnType<typeof mockShortlistService.getTeamForToken> | null>(null);

  useEffect(() => {
    const found = mockShortlistService.getTeamForToken(token);
    if (!found) {
      navigate("/shortlist/invalid", { replace: true });
      return;
    }
    setTeam(found);
  }, [navigate, token]);

  if (!team) {
    return null;
  }

  if (status === "failure") {
    return (
      <div className="min-h-screen bg-void text-fg flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-6 py-20">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-ember/25 bg-ember/[0.07]">
              <XCircle className="text-ember" size={36} />
            </div>
            <h1 className="mt-6 font-display text-3xl md:text-4xl">Payment Failed</h1>
            <p className="mt-3 text-sm text-muted">Your payment could not be completed. No amount has been recorded as paid.</p>
            <div className="mt-6 rounded-2xl border border-line bg-panel/20 p-4 text-left text-sm text-fg">
              <div className="flex justify-between gap-4 border-b border-line pb-2"><span>Team</span><span>{team.team_name}</span></div>
              <div className="flex justify-between gap-4 pt-2"><span>Team ID</span><span className="font-mono text-lumen">{team.team_id}</span></div>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => navigate(`/shortlist/${encodeURIComponent(team.mock_token)}/payment`)} className="btn-primary">Try Again</button>
              <Link to={`/shortlist/${encodeURIComponent(team.mock_token)}`} className="btn-ghost">Return to Team Dashboard</Link>
            </div>
          </motion.div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-xl text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-lumen/30 bg-lumen/[0.08] shadow-[0_0_40px_-8px_rgba(47,147,173,0.45)]">
            <CheckCircle2 className="text-lumen" size={36} />
          </div>
          <h1 className="mt-6 font-display text-3xl md:text-4xl">Payment Successful ✓</h1>
          <p className="mt-2 text-muted">Your participation in SPECATHON 2026 is confirmed.</p>

          <div className="mt-8 rounded-2xl border border-line bg-panel/20 p-5 text-left">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted">Team</p>
                <p className="mt-2 text-xl font-display">{team.team_name}</p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-mono uppercase tracking-[0.22em] text-muted">Amount Paid</p>
                <p className="mt-2 text-xl font-display text-lumen">₹{team.amount.toLocaleString("en-IN")}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-4 text-sm">
              <div className="flex items-center justify-between gap-4"><span className="text-muted">Team ID</span><span className="font-mono text-lumen">{team.team_id}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted">Transaction ID</span><span className="font-mono text-lumen">{tx || team.transaction_id || "SPC26MOCK"}</span></div>
              <div className="flex items-center justify-between gap-4"><span className="text-muted">Payment Status</span><span>PAID</span></div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to={`/shortlist/${encodeURIComponent(team.mock_token)}/receipt`} className="btn-primary">
              <Download size={16} />
              Download Receipt
            </Link>
            <Link to={`/shortlist/${encodeURIComponent(team.mock_token)}`} className="btn-ghost">Return to Dashboard</Link>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
