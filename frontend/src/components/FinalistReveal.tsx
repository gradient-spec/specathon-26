import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ScanLine, Sparkles } from "lucide-react";

/** Synthesize a soft ~1s impact chime with the Web Audio API (no assets). */
function playImpactChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;

    // Low "thud" for the stamp impact.
    const thud = ctx.createOscillator();
    thud.type = "triangle";
    thud.frequency.setValueAtTime(140, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.28);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.45, now);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    thud.connect(thudGain).connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.4);

    // Bright ascending bell triad for the "unlocked" shimmer.
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);
    ([[523.25, 0.0], [659.25, 0.05], [987.77, 0.1]] as const).forEach(([freq, t]) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(0.28, now + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      osc.connect(g).connect(master);
      osc.start(now + t);
      osc.stop(now + 1.0);
    });
    master.gain.exponentialRampToValueAtTime(0.4, now + 0.03);

    window.setTimeout(() => ctx.close().catch(() => {}), 1300);
  } catch {
    /* audio not available — silent, non-fatal */
  }
}

type Phase = "scan" | "reveal";

export default function FinalistReveal({
  show,
  teamName,
  onDone,
}: {
  show: boolean;
  teamName?: string;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("scan");
  const firedRef = useRef(false);

  // Sequence: 1.0s scan → reveal (stamp slam) → auto-dismiss.
  useEffect(() => {
    if (!show) {
      setPhase("scan");
      firedRef.current = false;
      return;
    }
    setPhase("scan");
    const toReveal = window.setTimeout(() => setPhase("reveal"), 1000);
    const toDone = window.setTimeout(() => onDone(), 4600);
    return () => {
      window.clearTimeout(toReveal);
      window.clearTimeout(toDone);
    };
  }, [show, onDone]);

  // Fire haptics + chime exactly at stamp impact.
  useEffect(() => {
    if (show && phase === "reveal" && !firedRef.current) {
      firedRef.current = true;
      try {
        navigator.vibrate?.([40, 60, 40]);
      } catch {
        /* no-op */
      }
      playImpactChime();
    }
  }, [show, phase]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="finalist-reveal"
          role="dialog"
          aria-label="Finalist confirmation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onDone}
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden cursor-pointer bg-void/85 backdrop-blur-md"
        >
          {/* Reactive grid + radial glow */}
          <div className="absolute inset-0 bg-grid [background-size:48px_48px] opacity-40" />
          <div className="absolute inset-0 bg-radial opacity-70" />

          {/* Sweeping scan laser */}
          {phase === "scan" && (
            <motion.div
              initial={{ y: "-30%" }}
              animate={{ y: "130%" }}
              transition={{ duration: 1, ease: "easeInOut" }}
              className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-lumen/25 to-transparent"
            >
              <div className="absolute bottom-0 inset-x-0 h-px bg-lumen shadow-[0_0_20px_2px_rgba(47,147,173,0.9)]" />
            </motion.div>
          )}

          {/* Shockwave rings on impact */}
          {phase === "reveal" && (
            <>
              {[0, 0.12].map((delay, i) => (
                <motion.span
                  key={i}
                  initial={{ scale: 0, opacity: 0.85 }}
                  animate={{ scale: 9, opacity: 0 }}
                  transition={{ duration: 1.0, ease: "easeOut", delay }}
                  className="absolute h-40 w-40 rounded-full border-2"
                  style={{ borderColor: i === 0 ? "rgba(47,147,173,0.7)" : "rgba(205,130,0,0.6)" }}
                />
              ))}
            </>
          )}

          {/* Center content */}
          <div className="relative flex flex-col items-center text-center px-6">
            {phase === "scan" ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-4"
              >
                <ScanLine size={40} className="text-lumen animate-pulse" />
                <div className="font-mono text-sm md:text-base uppercase tracking-[0.32em] text-lumen">
                  Decrypting Abstract Status…
                </div>
                <div className="mt-1 h-1 w-48 rounded-full bg-line overflow-hidden">
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: "0%" }}
                    transition={{ duration: 1, ease: "easeInOut" }}
                    className="h-full w-full bg-gradient-to-r from-lumen to-plasma"
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18 }}
                className="relative w-[min(88vw,420px)] rounded-3xl border border-line bg-panel/80 backdrop-blur-xl p-8 md:p-10 overflow-hidden shadow-[0_30px_80px_-24px_rgba(0,0,0,0.8)]"
              >
                {/* holographic sheen */}
                <div className="pointer-events-none absolute -inset-1 bg-gradient-to-br from-lumen/15 via-transparent to-plasma/15" />

                <div className="relative flex flex-col items-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-lumen/30 bg-lumen/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.24em] text-lumen">
                    <ShieldCheck size={12} /> Verified
                  </span>

                  <div className="mt-5 font-display font-bold text-3xl md:text-4xl tracking-tightest text-slate-100">
                    You're a{" "}
                    <span className="bg-gradient-to-r from-lumen to-emerald-400 bg-clip-text text-transparent">
                      Finalist
                    </span>
                  </div>
                  {teamName && (
                    <div className="mt-2 font-mono text-sm text-subtle uppercase tracking-[0.2em]">
                      {teamName}
                    </div>
                  )}

                  <div className="mt-6 flex items-center gap-1.5 text-gold">
                    <Sparkles size={14} />
                    <span className="font-mono text-[11px] uppercase tracking-[0.24em]">
                      SPECATHON 2026 · VIP Pass Unlocked
                    </span>
                  </div>
                </div>

                {/* Elastic diagonal stamp slam */}
                <motion.div
                  initial={{ scale: 3.2, opacity: 0, rotate: -22 }}
                  animate={{ scale: 1, opacity: 1, rotate: -12 }}
                  transition={{ type: "spring", stiffness: 700, damping: 17, mass: 1.1, delay: 0.05 }}
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                >
                  <div className="border-[3px] border-success rounded-lg px-4 py-2 text-success font-mono font-bold text-sm md:text-base uppercase tracking-[0.18em] bg-success/5 shadow-[0_0_30px_-6px_rgba(26,158,74,0.6)]">
                    Official Finalist · Approved
                  </div>
                </motion.div>
              </motion.div>
            )}

            <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.28em] text-muted">
              Tap anywhere to continue
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
