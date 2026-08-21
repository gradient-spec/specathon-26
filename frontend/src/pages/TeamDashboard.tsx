import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, CreditCard, CheckCircle2, AlertCircle, Home } from "lucide-react";
import TeamPortalLayout from "@/components/TeamPortalLayout";
import Reveal from "@/components/Reveal";
import TeamLogoutButton from "@/components/TeamLogoutButton";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { teamSupabase as supabase } from "@/services/supabase";

type TeamData = {
  team_id: string;
  team_name: string;
  team_lead_name: string;
  team_size: number;
  amount: number | null;
  payment_status: "PENDING" | "PAID" | "FAILED";
};

export default function TeamDashboard() {
  const { session, isTeam, teamId, loading: authLoading } = useTeamAuth();
  
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          .select("team_id, team_name, team_lead_name, team_size, amount, payment_status")
          .eq("team_id", teamId)
          .single();

        if (fetchError) throw fetchError;
        if (!teamData) throw new Error("Team record not found.");
        
        if (!cancelled) {
          setData(teamData as TeamData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load team data.");
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

  // If the team has already paid, redirect them directly to the success page
  if (data?.payment_status === "PAID") {
    return <Navigate to="/team/payment/f82b7c4a1e9d3a2f" replace />;
  }

  return (
    <TeamPortalLayout>
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-4">
        <div className="w-full max-w-5xl">
          <Reveal>
            <div className="card-team p-10 md:p-12">
              <div className="mb-7">
                <h1 className="font-display text-xl md:text-2xl tracking-tightest text-center md:text-left">Team Portal</h1>
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-xl border border-ember/30 bg-ember/[0.05] p-5">
                  <AlertCircle className="text-ember shrink-0 mt-0.5" size={22} />
                  <div>
                    <h3 className="text-base font-medium text-ember">Failed to load data</h3>
                    <p className="text-ember/80 text-sm mt-1">{error}</p>
                    <p className="text-xs text-ember/60 mt-2">
                      Please ensure your team is provisioned and contact support if this persists.
                    </p>
                  </div>
                </div>
              ) : data ? (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-muted mb-4">Team Details</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-8">
                      <div>
                        <div className="eyebrow !text-[11px] mb-1">Team ID</div>
                        <div className="text-base font-mono text-lumen">{data.team_id}</div>
                      </div>
                      <div>
                        <div className="eyebrow !text-[11px] mb-1">Team Name</div>
                        <div className="text-base text-fg">{data.team_name}</div>
                      </div>
                      <div>
                        <div className="eyebrow !text-[11px] mb-1">Team Lead</div>
                        <div className="text-base text-fg">{data.team_lead_name}</div>
                      </div>
                      <div>
                        <div className="eyebrow !text-[11px] mb-1">Team Size</div>
                        <div className="text-base text-fg">{data.team_size} Members</div>
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-line" />

                  <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-surface/30 rounded-xl p-5 md:p-6 border border-line">
                      <div className="text-right md:text-left">
                        <div className="eyebrow !text-[11px] mb-1">Amount Due</div>
                        <div className="font-display text-3xl text-lumen">
                          {data.amount != null ? `₹${data.amount}` : "Pending Calculation"}
                        </div>
                      </div>

                      <div className="h-px w-full md:h-14 md:w-px bg-line" />

                      <div className="flex-1">
                        {data.payment_status === "PENDING" && (
                          <div>
                            <button
                              type="button"
                              className="btn-primary w-full justify-center"
                              onClick={() => {
                                // Placeholder action
                                window.location.href = "https://smartpay.easebuzz.in/164413/764b0bbbb16b4e9295588536353e7e7b";
                              }}
                            >
                              <CreditCard size={16} />
                              Proceed to Payment →
                            </button>
                          </div>
                        )}

                        {data.payment_status === "FAILED" && (
                          <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember/10 border border-ember/20 text-ember text-xs font-medium mb-3">
                              <AlertCircle size={14} />
                              Payment Failed
                            </div>
                            <p className="text-xs text-ember/80 mb-3">
                              Your previous payment attempt was unsuccessful. Please try again.
                            </p>
                            <button
                              type="button"
                              className="btn-primary w-full justify-center"
                              onClick={() => {
                                window.location.href = "https://smartpay.easebuzz.in/164413/764b0bbbb16b4e9295588536353e7e7b";
                              }}
                            >
                              <CreditCard size={16} />
                              Retry Payment →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </Reveal>

          {/* Below the card — Return to Home (left) / Logout (right), same line on desktop */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link to="/" className="btn-ghost justify-center shrink-0 !text-xs !py-1.5 !px-3">
              <Home size={13} />
              Return to Home
            </Link>
            <TeamLogoutButton />
          </div>
        </div>
      </div>
    </TeamPortalLayout>
  );
}



