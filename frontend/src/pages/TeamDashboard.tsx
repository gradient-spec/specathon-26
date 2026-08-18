import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Users, CreditCard, CheckCircle2, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
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
  const { session, isTeam, loading: authLoading } = useTeamAuth();
  
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
        const { data: teamData, error: fetchError } = await supabase
          .from("shortlisted_teams")
          .select("team_id, team_name, team_lead_name, team_size, amount, payment_status")
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

      <main className="flex-1 pt-32 pb-20 px-6 relative z-10 flex justify-center">
        <div className="w-full max-w-3xl">
          <Reveal>
            <div className="flex items-center gap-3 mb-10">
              <div className="h-12 w-12 rounded-xl bg-lumen/15 border border-lumen/30 flex items-center justify-center">
                <Users size={20} className="text-lumen" />
              </div>
              <div>
                <h1 className="font-display text-3xl tracking-tightest">Team Portal</h1>
                <p className="text-muted text-sm mt-1">Manage your team's payment and registration</p>
              </div>
            </div>
          </Reveal>

          {error ? (
            <Reveal delay={0.1}>
              <div className="glass rounded-2xl p-8 border-ember/30 bg-ember/[0.05]">
                <div className="flex items-start gap-4">
                  <AlertCircle className="text-ember shrink-0 mt-1" size={24} />
                  <div>
                    <h3 className="text-lg font-medium text-ember">Failed to load data</h3>
                    <p className="text-ember/80 mt-1">{error}</p>
                    <p className="text-sm text-ember/60 mt-4">
                      Please ensure your team is provisioned and contact support if this persists.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          ) : data ? (
            <div className="space-y-6">
              <Reveal delay={0.1}>
                <div className="glass rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-medium text-fg mb-6">Team Details</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                    <div>
                      <div className="eyebrow mb-1">Team ID</div>
                      <div className="text-lg font-mono text-lumen">{data.team_id}</div>
                    </div>
                    <div>
                      <div className="eyebrow mb-1">Team Name</div>
                      <div className="text-lg text-fg">{data.team_name}</div>
                    </div>
                    <div>
                      <div className="eyebrow mb-1">Team Lead</div>
                      <div className="text-lg text-fg">{data.team_lead_name}</div>
                    </div>
                    <div>
                      <div className="eyebrow mb-1">Team Size</div>
                      <div className="text-lg text-fg">{data.team_size} Members</div>
                    </div>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="glass rounded-2xl p-6 md:p-8">
                  <h2 className="text-xl font-medium text-fg mb-6">Payment Status</h2>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-surface/30 rounded-xl p-6 border border-line">
                    <div>
                      <div className="eyebrow mb-1">Amount Due</div>
                      <div className="font-display text-4xl text-lumen">
                        {data.amount != null ? `₹${data.amount}` : "Pending Calculation"}
                      </div>
                    </div>

                    <div className="h-px w-full md:h-16 md:w-px bg-line" />

                    <div className="flex-1">
                      {data.payment_status === "PENDING" && (
                        <div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-4">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            Payment Required
                          </div>
                          <button
                            type="button"
                            className="btn-primary w-full justify-center"
                            onClick={() => {
                              // Placeholder action
                              window.location.href = "https://smartpay.easebuzz.in/164413/95d992d915e94ec8893b2ab6cce3477e";
                            }}
                          >
                            <CreditCard size={18} />
                            Proceed to Payment →
                          </button>
                        </div>
                      )}

                      {data.payment_status === "PAID" && (
                        <div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald/10 border border-emerald/20 text-emerald text-sm font-medium mb-3">
                            <CheckCircle2 size={16} />
                            PAYMENT CONFIRMED
                          </div>
                          <p className="text-sm text-muted">
                            Your team's payment has already been recorded. No further action is required.
                          </p>
                          <Link to="/team/spin" className="btn-primary w-full justify-center mt-4">
                            Access Spin Wheel
                          </Link>
                        </div>
                      )}

                      {data.payment_status === "FAILED" && (
                        <div>
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ember/10 border border-ember/20 text-ember text-sm font-medium mb-4">
                            <AlertCircle size={16} />
                            Payment Failed
                          </div>
                          <p className="text-sm text-ember/80 mb-4">
                            Your previous payment attempt was unsuccessful. Please try again.
                          </p>
                          <button
                            type="button"
                            className="btn-primary w-full justify-center"
                            onClick={() => {
                              window.location.href = "https://smartpay.easebuzz.in/164413/95d992d915e94ec8893b2ab6cce3477e";
                            }}
                          >
                            <CreditCard size={18} />
                            Retry Payment →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}



