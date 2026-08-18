import { useEffect, useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Loader2, Trophy, AlertCircle } from "lucide-react";
import Reveal from "@/components/Reveal";
import { useTeamAuth } from "@/hooks/TeamAuthContext";
import { teamSupabase as supabase } from "@/services/supabase";
import { toast } from "sonner";

export default function TeamSpinWheel() {
  const { session, isTeam, loading: authLoading } = useTeamAuth();
  
  const [loading, setLoading] = useState(true);
  const [eligibilityState, setEligibilityState] = useState<"ELIGIBLE" | "NOT_ISSUED" | "ALREADY_SPUN" | "DISABLED" | "ERROR" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  type Segment = { id: string; type: "genuine" | "dummy"; label: string };
  const [segments, setSegments] = useState<Segment[]>([]);
  const [pastResult, setPastResult] = useState<string | null>(null);
  
  // Animation state
  const [spinning, setSpinning] = useState(false);
  const [spinRotation, setSpinRotation] = useState(0);
  
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);

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
        
        // 1. Fetch Wheel Config
        const { data: config, error: configError } = await supabase.from("wheel_config").select("*").eq("id", 1).single();
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
          if (!cancelled) {
            setEligibilityState("DISABLED");
            setLoading(false);
          }
          return;
        }

        // 2. Fetch Spin Ticket Status
        const { data: teamData, error: teamError } = await supabase
          .from("shortlisted_teams")
          .select("spin_ticket")
          .single();
        if (teamError) throw teamError;

        if (config.current_mode === "LIVE" && teamData.spin_ticket === "NOT_ISSUED") {
          if (!cancelled) {
            setEligibilityState("NOT_ISSUED");
            setLoading(false);
          }
          return;
        }

        // 3. Fetch Spin Attempts
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

        if (!cancelled) {
          setEligibilityState("ELIGIBLE");
        }
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

    return () => {
      cancelled = true;
    };
  }, [authLoading, session, isTeam]);

  const handleSpin = async () => {
    if (eligibilityState !== "ELIGIBLE" || spinning) return;
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    setSpinning(true);
    setShowResultOverlay(false);
    
    let hasResult = false;
    let backendResult: string | null = null;
    let hasError = false;
    let errorMessage = "";
    
    // Concurrently trigger backend
    const fetchResult = async () => {
      try {
        const { data, error } = await supabase!.rpc("execute_spin");
        if (error) throw error;
        backendResult = data.result;
        hasResult = true;
      } catch (err: any) {
        hasError = true;
        errorMessage = err.message;
      }
    };
    fetchResult();

    const maxSpeed = 15; // degrees per frame
    const accel = 0.25;
    let speed = 0;
    let currentAng = spinRotation;
    
    const spinStartTime = performance.now();
    const minSpinTime = 2500; // at least 2.5 seconds of free spinning
    
    let phase = "accelerate"; 
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
        if (speed >= maxSpeed) {
          speed = maxSpeed;
          phase = "coast";
        }
      } else if (phase === "coast") {
        if (now - spinStartTime > minSpinTime && hasResult && backendResult) {
          const targetIndex = segments.findIndex(s => s.id === backendResult);
          
          // Exact center of the segment
          const segmentCenterAngle = targetIndex * 45 + 22.5;
          const targetMod = (360 - segmentCenterAngle) % 360;
          
          // Natural stopping distance based on friction = 0.04
          const friction = 0.04;
          const naturalStopDist = (speed * speed) / (2 * friction);
          const naturalStopAngle = currentAng + naturalStopDist;
          
          const remainder = (targetMod - (naturalStopAngle % 360) + 360) % 360;
          // Add random extra rotations (0, 1, or 2) for game-like variety
          const randomExtra = Math.floor(Math.random() * 3) * 360;
          targetAngle = naturalStopAngle + remainder + randomExtra;
          
          phase = "decelerate";
        }
      }
      
      if (phase === "decelerate") {
        const distRemaining = targetAngle - currentAng;
        
        if (distRemaining <= 0 || speed <= 0) {
          currentAng = targetAngle;
          if (wheelRef.current) {
            wheelRef.current.style.transform = `rotate(${currentAng}deg)`;
          }
          setSpinRotation(currentAng % 360); // Keep state normalized to prevent massive numbers
          setTimeout(() => {
            setShowResultOverlay(true);
            setEligibilityState("ALREADY_SPUN");
            setPastResult(backendResult);
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
      if (wheelRef.current) {
        wheelRef.current.style.transform = `rotate(${currentAng}deg)`;
      }
      
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

  if (!session || !isTeam) {
    return <Navigate to="/team/login" replace />;
  }

  // Determine display components based on state
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
                ? `YOU WON: ${segments.find(s => s.id === pastResult)?.label}` 
                : "BETTER LUCK NEXT TIME"}
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

  return (
    <div className="w-full relative z-10 flex flex-col items-center">
        <Reveal className="w-full max-w-3xl text-center mb-8">
          {/* <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lumen/10 border border-lumen/20 text-lumen text-xs font-medium mb-4">
            <Trophy size={14} />
            SPECATHON REWARDS
          </div> */}
          <h1 className="font-display text-4xl tracking-tight mb-4">Gradient Spin Wheel</h1>
          <p className="text-muted max-w-xl mx-auto">
            Try your luck! Grab exclusive rewards. One spin per team.
          </p>
        </Reveal>

        {/* Wheel Container */}
        <Reveal delay={0.1} className="w-full flex justify-center mb-10">
          <div className="relative w-[320px] h-[320px] sm:w-[400px] sm:h-[400px]">
            {/* Outer Glow */}
            <div className="absolute inset-[-20%] bg-lumen/5 blur-[100px] rounded-full pointer-events-none" />
            
            {/* Pointer */}
            <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]">
              <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[24px] border-t-lumen" />
            </div>

            {/* The Wheel */}
            <div className="absolute inset-0 rounded-full border-8 border-surface bg-void overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.1)]">
              <div 
                ref={wheelRef}
                className="w-full h-full relative"
                style={{ transform: `rotate(${spinRotation}deg)` }}
              >
                {/* Background Wedges */}
                {segments.map((segment, index) => {
                  const rotation = index * 45;
                  const isGenuine = segment.type === "genuine";
                  return (
                    <div 
                      key={`wedge-${segment.id}`}
                      className="absolute top-0 left-1/2 w-1/2 h-1/2 origin-bottom-left"
                      style={{
                        transform: `rotate(${rotation}deg) skewY(-45deg)`,
                        backgroundColor: isGenuine ? "rgba(0, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                        borderLeft: "1px solid rgba(255, 255, 255, 0.05)"
                      }}
                    />
                  );
                })}
                {/* Text Labels */}
                {segments.map((segment, index) => {
                  const radialCenterAngle = index * 45 + 22.5;
                  const isGenuine = segment.type === "genuine";
                  const isLeftHalf = radialCenterAngle > 180;
                  const rotation = radialCenterAngle - 90;
                  return (
                    <div 
                      key={`label-${segment.id}`}
                      className="absolute top-1/2 left-1/2 w-1/2 h-10 -mt-5 origin-left flex items-center pointer-events-none"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        paddingLeft: "40px",
                        paddingRight: "15px",
                      }}
                    >
                      <div 
                        className="w-full text-[12px] sm:text-[13px] font-medium leading-tight text-center"
                        style={{
                          transform: isLeftHalf ? "rotate(180deg)" : "none",
                          color: isGenuine ? "var(--color-lumen)" : "var(--color-muted)",
                          textShadow: isGenuine ? "0 0 10px rgba(0,255,255,0.3)" : "none",
                          wordBreak: "break-word"
                        }}
                      >
                        {segment.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Center Hub */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-void border-4 border-surface shadow-inner z-20 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-lumen/50" />
              </div>
            </div>
            
            {/* Result Reveal Overlay */}
            {showResultOverlay && pastResult && (
              <div className="absolute inset-[-10px] sm:inset-[-20px] rounded-full bg-void/90 backdrop-blur-md z-40 flex flex-col items-center justify-center border border-lumen/20 p-6 text-center animate-in fade-in duration-500">
                {pastResult.startsWith("PRIZE") ? (
                  <>
                    <Trophy className="text-lumen mb-2" size={32} />
                    <div className="eyebrow text-lumen mb-1">YOU WON</div>
                    <div className="text-lg sm:text-xl font-medium text-fg">
                      {segments.find(s => s.id === pastResult)?.label}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="eyebrow text-muted mb-1">RESULT</div>
                    <div className="text-base sm:text-lg font-medium text-fg">
                      BETTER LUCK NEXT TIME
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.2} className="w-full text-center z-10 flex flex-col items-center gap-6">
          {eligibilityState === "ELIGIBLE" && (
            <button 
              onClick={handleSpin}
              disabled={spinning}
              className="btn-primary w-full max-w-xs justify-center py-3 text-sm tracking-widest uppercase disabled:opacity-50 transition-all"
            >
              SPIN THE WHEEL
            </button>
          )}

          {renderMessage()}

          
        </Reveal>
      
    </div>
  );
}

