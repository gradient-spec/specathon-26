import { useEffect, useState } from "react";
import TeamSpinWheel from "./TeamSpinWheel";
import { Navigate, Link } from "react-router-dom";
import { Loader2, Info, Home } from "lucide-react";
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
  spin_ticket: "NOT_ISSUED" | "AVAILABLE" | "USED";
};

export default function TeamPaymentSuccess() {
  const { session, isTeam, teamId, loading: authLoading } = useTeamAuth();
  
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
          .select("team_id, team_name, contact, team_size, amount, payment_status, spin_ticket")
          .eq("team_id", teamId)
          .single();

        if (fetchError) throw fetchError;
        
        if (!cancelled) {
          setData(teamData as TeamData);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          const msg = (err as { message?: string })?.message ?? String(err);
          setFetchError(msg);
        }
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
      <div className="flex-1 flex items-center justify-center px-6 pt-24 md:pt-16 pb-4">
        {/* 30% payment summary / 30% spin wheel / 40% intentionally empty */}
        {/*
          30/30/40 is an overall-screen-occupancy target, not three equal
          grid columns: the two cards below sit side-by-side with a large
          gap, centered on the page — the surrounding/between space is what
          reads as the ~40% intentionally empty area, not a rendered column.
        */}
        <div className="w-full max-w-[960px] mx-auto grid grid-cols-1 md:grid-cols-2 items-stretch gap-y-10 gap-x-12 lg:gap-x-20">
          <Reveal className="md:h-full">
            <div className="card-team border-emerald-500/50 shadow-[0_0_45px_-10px_rgba(16,185,129,0.45)] p-6 md:p-8 h-full flex flex-col">
              <div className="text-center mb-6">
                <h1 className="font-display text-2xl tracking-tight">Payment Summary</h1>
              </div>

              {fetchError && !data && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 text-xs text-red-300">
                  Failed to load payment data: {fetchError}
                </div>
              )}

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

                  <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3">
                    <span className="text-xs text-muted block mb-1">Amount</span>
                    <span className="font-mono text-lg text-emerald-400 font-semibold">
                      {data.amount != null ? `₹${data.amount}` : "—"}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-3 mb-6">
                <Info size={18} className="text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-100/80">
                  <span className="font-medium text-yellow-400 block mb-1">Awaiting Payment Verification</span>
                  Your payment confirmation will be reflected once the payment is verified in the SPECATHON payment system.
                </div>
              </div>

              <div className="mt-auto flex justify-center">
                <Link to="/" className="btn-ghost w-full sm:w-auto justify-center">
                  <Home size={16} />
                  Return to Home Page
                </Link>
              </div>
            </div>

            <p className="mt-3 text-center text-xs text-muted">
              If any queries, contact our{" "}
              <a href="/#contact" className="text-cyan-400 hover:underline">Organizers</a>.
            </p>
          </Reveal>

          <Reveal delay={0.1} className="md:h-full">
            <div className="card-team p-6 md:p-8 h-full flex flex-col items-center justify-center">
              <TeamSpinWheel />
            </div>
          </Reveal>
        </div>
      </div>
    </TeamPortalLayout>
  );
}

