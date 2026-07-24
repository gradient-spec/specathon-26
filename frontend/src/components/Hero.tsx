import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight } from "lucide-react";
import DateCounter from "./DateCounter";

export default function Hero() {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Kinetic reveal of the wordmark.
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
      className="group relative min-h-[85svh] flex flex-col justify-center pt-24 pb-6 overflow-hidden noise"
    >
      <div className="relative mx-auto max-w-5xl w-full px-6 md:px-10 flex flex-col items-center text-center">
        {/* Wordmark: SPECATHON [2026 glass badge] */}
        <h1
          ref={titleRef}
          className="hero-title font-display font-bold leading-[1.25] text-[clamp(2.5rem,8.5vw,7.5rem)] tracking-tightest flex items-center justify-center flex-nowrap gap-x-4 md:gap-x-6 py-4 px-2 overflow-visible"
          aria-label="SPECATHON 2026"
        >
          <span className="overflow-visible inline-flex italic py-2 px-1">
            {title.split("").map((c, i) => (
              <span
                key={i}
                data-char
                className={`inline-block will-change-transform py-1 px-[2px] ${c === '.' ? 'text-lumen' : 'shimmer-text'}`}
                style={c === '.' ? undefined : ({ "--delay": `${i * 0.15}s` } as React.CSSProperties)}
              >
                {c}
              </span>
            ))}
          </span>
          <motion.span
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 2.3, type: "spring", stiffness: 180, damping: 16 }}
            className="font-bold text-lumen text-[clamp(2.5rem,8.5vw,7.5rem)]"
            style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}
          >
            2026
          </motion.span>
        </h1>

        {/* Tagline — placed above date badge */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.6, duration: 0.7 }}
          className="mt-8 font-display text-xl md:text-3xl text-fg/90 tracking-tight"
        >
          <span className="text-lumen">A 36-Hour</span> National Level Hackathon
        </motion.p>

        {/* Date Display Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.8, duration: 0.6 }}
          className="mt-6"
        >
          <DateCounter
            value="11 & 12 SEP"
            delay={80}
            startDelay={2800}
            animateBy="words"
            direction="bottom"
          />
        </motion.div>

        {/* About — clean text without card background or title */}
        <motion.div
          id="about"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.95, duration: 0.6 }}
          className="mt-8 scroll-mt-24 max-w-4xl text-center mx-auto"
        >
          <p className="text-fg/80 text-base md:text-lg leading-relaxed font-body">
            Thirty-six hours, one campus, and a room full of builders. SPECATHON is
            SPEC's flagship national hackathon — pick a problem, ship a working demo,
            and defend it in front of mentors and judges.
          </p>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.1, duration: 0.6 }}
          className="mt-10 flex justify-center items-center w-full"
        >
          <a href="#register" id="hero-register-btn" className="btn-primary group/btn !px-8 !py-4 text-base">
            Register Now
            <ArrowRight size={18} className="transition-transform group-hover/btn:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}


