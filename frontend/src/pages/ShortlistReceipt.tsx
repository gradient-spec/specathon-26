import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Download, FileText } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getMockReceiptData, mockShortlistService, type MockTeam } from "@/services/mockShortlist";

export default function ShortlistReceipt() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<MockTeam | null>(null);

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

  const receipt = getMockReceiptData(team);

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-20">
        <div className="rounded-2xl border border-line bg-panel/20 p-6 md:p-8">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <FileText size={11} />
              SPECATHON 2026
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Participation Payment Receipt</h1>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between gap-4"><span className="text-muted">Team ID</span><span className="font-mono text-lumen">{receipt.teamId}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Team</span><span>{receipt.teamName}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Team Lead</span><span>{receipt.teamLead}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Amount</span><span>{receipt.amount}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Transaction ID</span><span className="font-mono text-lumen">{receipt.transactionId}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Payment Status</span><span>{receipt.paymentStatus}</span></div>
            <div className="flex justify-between gap-4"><span className="text-muted">Payment Date</span><span>{new Date(receipt.paymentDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span></div>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => window.print()} className="btn-primary flex-1 justify-center">
              <Download size={16} />
              Download Receipt
            </button>
            <Link to={`/shortlist/${encodeURIComponent(team.mock_token)}`} className="btn-ghost flex-1 justify-center">Return to Dashboard</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
