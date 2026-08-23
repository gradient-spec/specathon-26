import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import { Loader2, Trophy, AlertCircle, X } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { teamSupabase as supabase } from "@/services/supabase";
import { toast } from "sonner";

const SEG_COUNT = 8;
const SEG_DEG = 360 / SEG_COUNT;

function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

export default function TeamSpinWheel() {
  const { session, isTeam, teamId, loading: authLoading } = useTeamAuth();

  const [loading, setLoading] = useState(true);
  const [eligibilityState, setEligibilityState] = useState<
    "ELIGIBLE" | "NOT_ISSUED" | "ALREADY_SPUN" | "DISABLED" | "ERROR" | null
  >(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  type Segment = { id: string; type: "genuine" | "dummy"; label: string };
  const [segments, setSegments] = useState<Segment[]>([]);
  const [pastResult, setPastResult] = useState<string | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef(0);

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

        const { data: config, error: configError } = await supabase
          .from("wheel_config")
          .select("*")
          .eq("id", 1)
          .single();
        if (configError) throw configError;

        if (!cancelled) {
          setSegments([
            { id: "PRIZE_1", type: "genuine", label: config.prize_1_name },
            { id: "DUMMY_1", type: "dummy", label: config.dummy_1_name || "T-Shirt" },
            { id: "BETTER_LUCK_A", type: "genuine", label: config.better_luck_a_name || "Better luck next time" },
            { id: "DUMMY_2", type: "dummy", label: config.dummy_2_name || "Sticker Pack" },
            { id: "PRIZE_2", type: "genuine", label: config.prize_2_name },
            { id: "DUMMY_3", type: "dummy", label: config.dummy_3_name || "Water Bottle" },
            { id: "BETTER_LUCK_B", type: "genuine", label: config.better_luck_b_name || "Try again next year" },
            { id: "DUMMY_4", type: "dummy", label: config.dummy_4_name || "Coffee Mug" },
          ]);
        }

        if (!config.is_enabled) {
          if (!cancelled) { setEligibilityState("DISABLED"); setLoading(false); }
          return;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("shortlisted_teams")
          .select("spin_ticket")
          .eq("team_id", teamId)
          .single();
        if (teamError) throw teamError;

        if (config.current_mode === "LIVE" && teamData.spin_ticket === "NOT_ISSUED") {
          if (!cancelled) { setEligibilityState("NOT_ISSUED"); setLoading(false); }
          return;
        }

        const { data: attempts, error: attemptsError } = await supabase
          .from("spin_attempts")
          .select("result");
        if (attemptsError) throw attemptsError;

        if (attempts && attempts.length > 0) {
          if (!cancelled) {
            setEligibilityState("ALREADY_SPUN");
            setPastResult(attempts[0].result);
            setShowResultOverlay(true);
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setEligibilityState("ELIGIBLE");
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setEligibilityState("ERROR");
          setErrorMsg(err instanceof Error ? err.message : "Failed to load wheel state.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [authLoading, session, isTeam, teamId]);

  useEffect(() => {
    if (eligibilityState === "ALREADY_SPUN" && pastResult && segments.length > 0 && wheelRef.current) {
      const idx = segments.findIndex((s) => s.id === pastResult);
      if (idx >= 0) {
        const rot = (360 - (idx * SEG_DEG + SEG_DEG / 2)) % 360;
        rotationRef.current = rot;
        wheelRef.current.style.transform = `rotate(${rot}deg)`;
      }
    }
  }, [eligibilityState, pastResult, segments]);

  const handleSpin = async () => {
    if (eligibilityState !== "ELIGIBLE" || spinning) return;
    if (!supabase) return;

    setSpinning(true);
    setShowResultOverlay(false);

    let hasResult = false;
    let backendResult: string | null = null;
    let hasError = false;
    let errorMessage = "";

    const fetchResult = async () => {
      try {
        const { data, error } = await supabase!.rpc("execute_spin");
        if (error) throw error;
        backendResult = data.result;
        hasResult = true;
      } catch (err: unknown) {
        hasError = true;
        errorMessage = err instanceof Error ? err.message : "Spin failed unexpectedly.";
      }
    };
    fetchResult();

    const maxSpeed = 15;
    const accel = 0.25;
    let speed = 0;
    let currentAng = rotationRef.current;
    const spinStartTime = performance.now();
    const minSpinTime = 2500;
    let phase: "accelerate" | "coast" | "decelerate" = "accelerate";
    let targetAngle = 0;

    const tick = () => {
      const now = performance.now();

      if (hasError) {
        setSpinning(false);
        if (errorMessage.includes("spin ticket available")) {
          toast.error("Payment verification is still pending.");
        } else if (errorMessage.includes("already spun")) {
          toast.error("Your spin has already been used.");
        } else if (errorMessage.includes("Wheel is currently disabled")) {
          toast.error("The spin wheel is currently unavailable.");
        } else {
          toast.error(errorMessage);
        }
        setTimeout(() => window.location.reload(), 2000);
        return;
      }

      if (phase === "accelerate") {
        speed += accel;
        if (speed >= maxSpeed) { speed = maxSpeed; phase = "coast"; }
      } else if (phase === "coast") {
        if (now - spinStartTime > minSpinTime && hasResult && backendResult) {
          const targetIndex = segments.findIndex((s) => s.id === backendResult);
          const segCenter = targetIndex * SEG_DEG + SEG_DEG / 2;
          const targetMod = (360 - segCenter) % 360;
          const friction = 0.04;
          const naturalStopDist = (speed * speed) / (2 * friction);
          const naturalStopAngle = currentAng + naturalStopDist;
          const remainder = (targetMod - (naturalStopAngle % 360) + 360) % 360;
          const randomExtra = Math.floor(Math.random() * 3) * 360;
          targetAngle = naturalStopAngle + remainder + randomExtra;
          phase = "decelerate";
        }
      }

      if (phase === "decelerate") {
        const distRemaining = targetAngle - currentAng;
        if (distRemaining <= 0 || speed <= 0) {
          currentAng = targetAngle;
          if (wheelRef.current) wheelRef.current.style.transform = `rotate(${currentAng}deg)`;
          rotationRef.current = currentAng % 360;
          setSpinning(false);
          setTimeout(() => {
            setShowResultOverlay(true);
            setEligibilityState("ALREADY_SPUN");
            setPastResult(backendResult);
            setShowResultModal(true);
          }, 1000);
          return;
        }
        let dynamicFriction = (speed * speed) / (2 * distRemaining);
        if (dynamicFriction < 0.01) dynamicFriction = 0.01;
        if (distRemaining < 5) dynamicFriction = speed;
        speed -= dynamicFriction;
        if (speed < 0) speed = 0;
      }

      currentAng += speed;
      if (wheelRef.current) wheelRef.current.style.transform = `rotate(${currentAng}deg)`;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-lumen" size={32} />
      </div>
    );
  }

  if (!session || !isTeam) return <Navigate to="/team/login" replace />;

  const renderMessage = () => {
    switch (eligibilityState) {
      case "NOT_ISSUED":
        return (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 max-w-md mx-auto">
            <AlertCircle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-100/80 text-left">
              <span className="font-medium text-amber-500 block mb-1">Spin Unavailable</span>
              Your successful payment return has not produced a spin ticket yet. Please wait for verification.
            </div>
          </div>
        );
      case "DISABLED":
        return (
          <div className="bg-surface/50 border border-line rounded-xl p-4 flex justify-center max-w-md mx-auto">
            <span className="text-muted">The spin wheel is currently unavailable.</span>
          </div>
        );
      case "ALREADY_SPUN":
        return (
          <div className="bg-surface/50 border border-line rounded-xl p-6 text-center max-w-md mx-auto">
            <div className="eyebrow mb-2">Spin Status</div>
            <h3 className="text-lg font-medium text-fg mb-1">Your spin has already been used.</h3>
            <p className="text-sm text-muted">
              {pastResult?.startsWith("PRIZE")
                ? `YOU WON: ${segments.find((s) => s.id === pastResult)?.label}`
                : segments.find((s) => s.id === pastResult)?.label}
            </p>
          </div>
        );
      case "ERROR":
        return (
          <div className="bg-ember/10 border border-ember/20 rounded-xl p-4 flex gap-3 max-w-md mx-auto">
            <AlertCircle size={20} className="text-ember shrink-0 mt-0.5" />
            <div className="text-sm text-ember/80 text-left">
              <span className="font-medium text-ember block mb-1">System Error</span>
              {errorMsg}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const showWheel = eligibilityState === "ELIGIBLE" || eligibilityState === "ALREADY_SPUN";

  const CX = 150;
  const CY = 150;
  const RIM_R = 140;
  const SEG_R = 128;
  const HUB_R = 26;
  const STUD_COUNT = 24;
  const segFills = ["#0e3550", "#111a28"];

  return (
    <div className="w-full relative z-10 flex flex-col items-center">
      <Reveal className="w-full max-w-xs sm:max-w-sm text-center mb-4">
        <h1 className="font-display text-xl sm:text-2xl tracking-tight">Specathon Spin Wheel</h1>
        <p className="text-xs text-muted mt-1">Try your luck, Win rewards</p>
      </Reveal>

      {showWheel && segments.length > 0 && (
        <Reveal delay={0.1} className="w-full flex justify-center mb-5">
          <div
            className="relative w-[230px] h-[230px] sm:w-[270px] sm:h-[270px]"
            style={{ filter: "drop-shadow(0 12px 30px rgba(0,0,0,0.5))" }}
          >
            <div className="absolute inset-[-18%] bg-lumen/5 blur-[80px] rounded-full pointer-events-none" />

            <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
              <div
                className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[22px] border-t-cyan-300"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.6)) drop-shadow(0 0 10px rgba(0,255,255,0.8))" }}
              />
              <div className="-mt-1.5 h-3 w-3 rounded-full bg-gradient-to-b from-cyan-100 to-cyan-500 border border-cyan-200/60 shadow-[0_0_8px_rgba(0,255,255,0.9)]" />
            </div>

            <div ref={wheelRef} className="w-full h-full will-change-transform" style={{ transform: `rotate(${rotationRef.current}deg)` }}>
              <svg viewBox="0 0 300 300" className="w-full h-full block">
                <defs>
                  <radialGradient id="swRimGrad" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#4a6478" />
                    <stop offset="60%" stopColor="#2a3a4a" />
                    <stop offset="100%" stopColor="#15202d" />
                  </radialGradient>
                  <radialGradient id="swHubGrad" cx="40%" cy="35%">
                    <stop offset="0%" stopColor="#2d4050" />
                    <stop offset="100%" stopColor="#0c1218" />
                  </radialGradient>
                  <radialGradient id="swGloss" cx="35%" cy="30%" r="65%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                    <stop offset="40%" stopColor="rgba(255,255,255,0.03)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </radialGradient>
                </defs>

                <circle cx={CX} cy={CY} r={RIM_R} fill="url(#swRimGrad)" stroke="#1a2a38" strokeWidth="3" />

                <circle cx={CX} cy={CY} r={RIM_R - 7} fill="none" stroke="rgba(0,200,240,0.12)" strokeWidth="0.5" />

                {segments.map((seg, i) => {
                  const start = i * SEG_DEG - 90;
                  const end = start + SEG_DEG;
                  return (
                    <path
                      key={seg.id}
                      d={wedgePath(CX, CY, SEG_R, start, end)}
                      fill={segFills[i % 2]}
                      stroke="rgba(0,200,240,0.08)"
                      strokeWidth="0.5"
                    />
                  );
                })}

                {segments.map((_, i) => {
                  const angleDeg = i * SEG_DEG - 90;
                  const rad = (angleDeg * Math.PI) / 180;
                  const inner = HUB_R + 4;
                  return (
                    <line
                      key={`d${i}`}
                      x1={CX + inner * Math.cos(rad)}
                      y1={CY + inner * Math.sin(rad)}
                      x2={CX + SEG_R * Math.cos(rad)}
                      y2={CY + SEG_R * Math.sin(rad)}
                      stroke="rgba(0,210,240,0.15)"
                      strokeWidth="1"
                    />
                  );
                })}

                {Array.from({ length: STUD_COUNT }).map((_, i) => {
                  const angleDeg = (i * 360) / STUD_COUNT - 90;
                  const rad = (angleDeg * Math.PI) / 180;
                  const sr = RIM_R - 4;
                  return (
                    <circle
                      key={`s${i}`}
                      cx={CX + sr * Math.cos(rad)}
                      cy={CY + sr * Math.sin(rad)}
                      r={2.2}
                      fill="rgba(0,230,255,0.55)"
                    />
                  );
                })}

                <circle cx={CX} cy={CY} r={SEG_R} fill="none" stroke="rgba(0,200,240,0.12)" strokeWidth="1.5" />

                <circle cx={CX} cy={CY} r={SEG_R} fill="url(#swGloss)" />

                <circle cx={CX} cy={CY} r={HUB_R} fill="url(#swHubGrad)" stroke="rgba(0,210,240,0.25)" strokeWidth="2" />
                <circle cx={CX} cy={CY} r={HUB_R - 8} fill="#080d13" stroke="rgba(0,210,240,0.15)" strokeWidth="1.5" />
                <circle cx={CX} cy={CY} r={5} fill="rgba(0,230,255,0.75)" />
                <circle cx={CX} cy={CY} r={5} fill="none" stroke="rgba(0,255,255,0.3)" strokeWidth="1" />
              </svg>

              {segments.map((seg, i) => {
                const centerAngle = i * SEG_DEG + SEG_DEG / 2;
                const isLeftHalf = centerAngle > 180;
                const rotation = centerAngle - 90;
                return (
                  <div
                    key={`lbl-${seg.id}`}
                    className="absolute top-1/2 left-1/2 w-1/2 h-7 -mt-3.5 origin-left flex items-center pointer-events-none"
                    style={{ transform: `rotate(${rotation}deg)`, paddingLeft: "22%", paddingRight: "6%" }}
                  >
                    <div
                      className="w-full text-[8px] sm:text-[9px] font-semibold leading-tight text-center"
                      style={{
                        transform: isLeftHalf ? "rotate(180deg)" : "none",
                        color: seg.type === "genuine" ? "var(--color-lumen)" : "rgba(203,213,225,0.85)",
                        textShadow: seg.type === "genuine" ? "0 0 8px rgba(0,255,255,0.25)" : "none",
                      }}
                    >
                      {seg.label}
                    </div>
                  </div>
                );
              })}
            </div>

            {showResultOverlay && pastResult && (
              <div className="absolute inset-3 sm:inset-4 rounded-full bg-void/90 backdrop-blur-md z-40 flex flex-col items-center justify-center border border-lumen/20 p-4 text-center animate-in fade-in duration-500">
                {pastResult.startsWith("PRIZE") ? (
                  <>
                    <Trophy className="text-lumen mb-1.5" size={22} />
                    <div className="eyebrow text-lumen mb-1 !text-[9px]">YOU WON</div>
                    <div className="text-sm sm:text-base font-medium text-fg">
                      {segments.find((s) => s.id === pastResult)?.label}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="eyebrow text-muted mb-1 !text-[9px]">RESULT</div>
                    <div className="text-xs sm:text-sm font-medium text-fg">
                      {segments.find((s) => s.id === pastResult)?.label}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Reveal>
      )}

      <Reveal delay={0.2} className="w-full text-center z-10 flex flex-col items-center gap-3">
        {eligibilityState === "ELIGIBLE" && (
          <button
            onClick={handleSpin}
            disabled={spinning}
            className="btn-primary w-full max-w-[240px] justify-center py-2.5 text-xs tracking-widest uppercase disabled:opacity-50 transition-all"
          >
            {spinning ? "SPINNING…" : "SPIN THE WHEEL"}
          </button>
        )}
        {renderMessage()}
      </Reveal>

      {showResultModal &&
        pastResult &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-void/80 backdrop-blur-sm px-6"
            onClick={() => setShowResultModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`relative w-full max-w-sm rounded-2xl p-8 text-center border bg-slate-950 ${
                pastResult.startsWith("PRIZE")
                  ? "border-lumen/30 shadow-[0_0_60px_-15px_rgba(0,255,255,0.35)]"
                  : "border-line shadow-[0_0_40px_-15px_rgba(100,116,139,0.3)]"
              }`}
            >
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                aria-label="Close"
                className="absolute top-3 right-3 text-muted hover:text-fg transition-colors"
              >
                <X size={18} />
              </button>
              {pastResult.startsWith("PRIZE") ? (
                <>
                  <div className="text-4xl mb-3">🎉</div>
                  <h2 className="font-display text-2xl md:text-3xl tracking-tight mb-4 leading-snug">
                    Congratulations! You have won{" "}
                    <span className="text-lumen">{segments.find((s) => s.id === pastResult)?.label}</span>!
                  </h2>
                  <p className="text-sm text-muted leading-relaxed">
                    Please take a screenshot of this result and do not forget to collect your prize near the
                    Registration Desk on SPECATHON 2026.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl md:text-2xl tracking-tight mb-3 leading-snug text-fg">
                    {segments.find((s) => s.id === pastResult)?.label}
                  </h2>
                  <p className="text-sm text-muted leading-relaxed">
                    Thank you for spinning! Your result has been recorded.
                  </p>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
