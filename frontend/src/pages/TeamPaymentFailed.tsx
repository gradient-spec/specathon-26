import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, XCircle, ArrowLeft, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { teamSupabase as supabase } from "@/services/supabase";

type TeamData = {
  team_id: string;
  team_name: string;
  payment_status: "PENDING" | "PAID" | "FAILED";
};

export default function TeamPaymentFailed() {
  const { session, isTeam, loading: authLoading } = useTeamAuth();
  
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!session || !isTeam) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!supabase) throw new Error("Supabase client not initialized.");
        const { data: teamData, error: fetchError } = await supabase
          .from("shortlisted_teams")
          .select("team_id, team_name, payment_status")
          .single();

        if (fetchError) throw fetchError;
        
        if (!cancelled) {
          setData(teamData as TeamData);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, isTeam]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-void flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-lumen" size={32} />
        </main>
        <Footer />
      </div>
    );
  }

  // Route protection
  if (!session || !isTeam) {
    return <Navigate to="/team/login" replace />;
  }

  return (
    <div className="min-h-screen bg-void flex flex-col relative noise overflow-hidden">
      <div className="absolute inset-0 bg-grid [background-size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)] pointer-events-none" />
      <Navbar />

      <main className="flex-1 pt-32 pb-20 px-6 relative z-10 flex justify-center items-center">
        <div className="w-full max-w-lg">
          <Reveal>
            <div className="glass rounded-2xl p-8 md:p-10 border-ember/20 bg-ember/[0.02]">
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-ember/20 blur-xl rounded-full" />
                  <div className="h-20 w-20 rounded-full bg-ember/10 border border-ember/30 flex items-center justify-center relative z-10">
                    <XCircle size={40} className="text-ember" />
                  </div>
                </div>
              </div>

              <div className="text-center mb-8">
                <div className="eyebrow text-ember mb-3">Payment Return</div>
                <h1 className="font-display text-3xl tracking-tight mb-4">Payment Attempt Unsuccessful</h1>
                <p className="text-muted text-base">
                  We couldn't confirm this payment attempt.
                </p>
              </div>

              {data && (
                <div className="bg-surface/50 border border-line rounded-xl p-5 mb-8">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted">Team ID</span>
                    <span className="font-mono text-lumen">{data.team_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">Team Name</span>
                    <span className="text-fg">{data.team_name}</span>
                  </div>
                </div>
              )}

              <div className="bg-surface/50 border border-line rounded-xl p-4 flex gap-3 mb-8">
                <AlertCircle size={20} className="text-muted shrink-0 mt-0.5" />
                <div className="text-sm text-muted">
                  Your final payment status will be reflected once the payment is verified in the SPECATHON payment system.
                </div>
              </div>

              <div className="flex justify-center">
                <Link to="/team/payment" className="btn-secondary">
                  <ArrowLeft size={18} />
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
