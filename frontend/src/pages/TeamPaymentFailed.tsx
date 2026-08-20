import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, AlertCircle, Home, RotateCcw } from "lucide-react";
import TeamPortalLayout from "@/components/TeamPortalLayout";
import Reveal from "@/components/Reveal";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { teamSupabase as supabase } from "@/services/supabase";

type TeamData = {
  team_id: string;
  team_name: string;
  contact: string | null;
  team_size: number;
  amount: number | null;
  payment_status: "PENDING" | "PAID" | "FAILED";
};

export default function TeamPaymentFailed() {
  const { session, isTeam, teamId, loading: authLoading } = useTeamAuth();
  
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
        if (!teamId) throw new Error("Team identity not resolved.");
        const { data: teamData, error: fetchError } = await supabase
          .from("shortlisted_teams")
          .select("team_id, team_name, contact, team_size, amount, payment_status")
          .eq("team_id", teamId)
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
  }, [authLoading, session, isTeam, teamId]);

  if (authLoading || loading) {
    return (
      <TeamPortalLayout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-lumen" size={32} />
        </div>
      </TeamPortalLayout>
    );
  }

  // Route protection
  if (!session || !isTeam) {
    return <Navigate to="/team/login" replace />;
  }

  return (
    <TeamPortalLayout>
      <div className="flex-1 flex justify-center items-center px-6 pt-16 pb-4">
        <div className="w-full max-w-xl">
          <Reveal>
            <div className="card-team border-red-500/50 shadow-[0_0_45px_-10px_rgba(239,68,68,0.45)] p-8 md:p-10">
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl tracking-tight">Payment Unsuccessful</h1>
                <p className="text-red-400 text-sm font-medium mt-2">
                  Please try again
                </p>
              </div>

              {data && (
                <div className="bg-surface/50 border border-line rounded-xl p-4 mb-6 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Team ID</span>
                    <span className="font-mono text-sm text-lumen">{data.team_id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Team Name</span>
                    <span className="text-sm text-fg">{data.team_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Team Size</span>
                    <span className="text-sm text-fg">{data.team_size} Members</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">Team Lead Contact</span>
                    <span className="text-sm text-fg break-all">{data.contact ?? "—"}</span>
                  </div>

                  <div className="mt-2 rounded-lg border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
                    <span className="text-xs text-muted block mb-1">Amount</span>
                    <span className="font-mono text-lg text-red-400 font-semibold">
                      {data.amount != null ? `₹${data.amount}` : "—"}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-surface/50 border border-line rounded-xl p-4 flex gap-3 mb-6">
                <AlertCircle size={18} className="text-muted shrink-0 mt-0.5" />
                <div className="text-xs text-muted">
                  Your final payment status will be reflected once the payment is verified in the SPECATHON payment system.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-center gap-3">
                <button
                  type="button"
                  className="btn-primary justify-center"
                  onClick={() => {
                    window.location.href = "https://smartpay.easebuzz.in/164413/764b0bbbb16b4e9295588536353e7e7b";
                  }}
                >
                  Retry Payment
                  <RotateCcw size={16} />
                </button>

                <Link to="/" className="btn-ghost justify-center">
                  <Home size={16} />
                  Return to Home Page
                </Link>
              </div>

              <p className="mt-4 text-center text-xs text-muted">
                If any queries, contact our{" "}
                <Link to="/#contact" className="text-cyan-400 hover:underline">Organizers</Link>.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </TeamPortalLayout>
  );
}
