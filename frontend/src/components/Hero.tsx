import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight, Trophy, Clock } from "lucide-react";

/* Countdown to the Aug 31, 2026 seat-confirmation / payment deadline. */
const DEADLINE = new Date("2026-08-31T23:59:59+05:30").getTime();
function useDeadline() {
  const [t, setT] = useState(() => Math.max(0, DEADLINE - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setT(Math.max(0, DEADLINE - Date.now())), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    days: Math.floor(t / 86_400_000),
    hours: Math.floor((t % 86_400_000) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
    done: t <= 0,
  };
}

export default function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { days, hours, minutes, seconds } = useDeadline();

  useEffect(() => {
    if (!titleRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chars = titleRef.current.querySelectorAll("[data-char]");
    gsap.fromTo(
      chars,
      { yPercent: 115, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.03, duration: 1.05, ease: "expo.out", delay: 1.7 }
    );
  }, []);

  const title = "SPECATHON";

  return (
    <section
      id="top"
      className="group relative min-h-[92svh] flex flex-col justify-center pt-24 pb-10 overflow-hidden noise"
    >
      <div className="relative mx-auto max-w-5xl w-full px-6 md:px-10 flex flex-col items-center text-center">
        {/* Banner — Shortlisted Teams Announced */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.24em] text-lumen mb-8"
        >
          <Trophy size={12} />
          Shortlisted Teams Announced
        </motion.div>

        {/* Wordmark */}
        <h1
          ref={titleRef}
          className="hero-title font-display font-bold leading-[1.2] text-[clamp(2rem,8.5vw,6.5rem)] tracking-tightest flex items-center justify-center flex-wrap gap-x-4 md:flex-nowrap md:gap-x-6 py-2 px-2 overflow-visible"
          aria-label="SPECATHON 2026"
        >
          <span className="overflow-visible inline-flex py-2 px-1" style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}>
            {title.split("").map((c, i) => (
              <span
                key={i}
                data-char
                className="inline-block will-change-transform py-1 px-[2px] shimmer-text"
                style={{ "--delay": `${i * 0.15}s` } as React.CSSProperties}
              >
                {c}
              </span>
            ))}
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 2.3, type: "spring", stiffness: 180, damping: 16 }}
            className="font-bold text-lumen text-[clamp(2rem,8.5vw,6.5rem)]"
            style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}
          >
            2026
          </motion.span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.7 }}
          className="mt-6 font-display text-xl md:text-3xl text-fg/90 tracking-tight"
        >
          Shortlisted Teams <span className="text-lumen">Announced</span>
        </motion.p>

        {/* Seat-confirmation countdown to Aug 31 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6 }}
          className="mt-8"
        >
          <div className="eyebrow inline-flex items-center gap-2 mb-3 text-gold">
            <Clock size={11} /> Seat Confirmation Deadline · Aug 31, 2026
          </div>
          <div className="flex items-stretch justify-center gap-2 md:gap-3">
            <Cell label="Days" value={days} />
            <Sep />
            <Cell label="Hrs" value={hours} />
            <Sep />
            <Cell label="Min" value={minutes} />
            <Sep />
            <Cell label="Sec" value={seconds} />
          </div>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.05, duration: 0.6 }}
          className="mt-10 flex justify-center items-center w-full"
        >
          <a href="#shortlist-portal" id="hero-cta-btn" className="btn-primary group/btn !px-8 !py-4 text-base">
            Search Team Shortlist Status
            <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl glass px-3 md:px-5 py-2.5 md:py-3.5 min-w-[62px] md:min-w-[84px] text-center">
      <div className="font-mono text-3xl md:text-5xl tabular-nums tracking-tightest text-fg">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-1 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.28em] text-muted">
        {label}
      </div>
    </div>
  );
}

function Sep() {
  return <div className="flex items-center font-mono text-2xl md:text-4xl text-lumen/60 pb-3">:</div>;
}
