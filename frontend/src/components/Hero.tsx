import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import DateCounter from "./DateCounter";

export default function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null);

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


        {/* Official event dates — restored V1 slot-counter style/position */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6 }}
          className="mt-7"
        >
          <DateCounter value="11 & 12 SEP" startDelay={2900} />
        </motion.div>
        {/* Tagline — organizing department line */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.7 }}
          className="mt-6 max-w-2xl font-display text-base md:text-xl text-slate-200 leading-relaxed tracking-tight"
        >
          Registrations Closed -{" "}
          <span className="text-plasma font-semibold">Teams Shortlisted!</span>{" "}
        
        </motion.p>

        {/* Message to shortlisted + unselected teams — high contrast, stands out over the watermark */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.0, duration: 0.6 }}
          className="my-6 max-w-2xl text-lg md:text-xl font-medium text-slate-100 leading-relaxed"
        >
          Congratulations to all the{" "}
          <span className="font-semibold bg-gradient-to-r from-lumen to-emerald-400 bg-clip-text text-transparent">
            shortlisted teams
          </span>{" "}
          — you have come a long way! To all registered teams who didn't make the cut this time,
          thank you for participating and better luck next time.
        </motion.p>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.3, duration: 0.6 }}
          className="mt-10 flex justify-center items-center w-full"
        >
          <a href="#shortlist-portal" id="hero-cta-btn" className="btn-primary cta-shimmer group/btn !px-8 !py-4 text-base">
            Search Team Shortlist Status
            <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
