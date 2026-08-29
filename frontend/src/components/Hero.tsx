import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
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
      {
        yPercent: 0,
        opacity: 1,
        stagger: 0.03,
        duration: 1.05,
        ease: "expo.out",
        delay: 1.7,
      }
    );
  }, []);

  const title = "SPECATHON";

  return (
    <section
      id="top"
      className="group relative min-h-[92svh] flex flex-col justify-center pt-24 pb-10 overflow-hidden noise"
    >
      <div className="relative mx-auto max-w-5xl w-full px-6 md:px-10 flex flex-col items-center text-center">

        {/* Main SPECATHON 2026 Wordmark */}
        <h1
          ref={titleRef}
          className="hero-title font-display font-bold leading-[1.2] text-[clamp(2rem,8.5vw,6.5rem)] tracking-tightest flex items-center justify-center flex-wrap gap-x-4 md:flex-nowrap md:gap-x-6 py-2 px-2 overflow-visible"
          aria-label="SPECATHON 2026"
        >
          <span
            className="overflow-visible inline-flex py-2 px-1"
            style={{
              fontFamily: '"Playfair Display", ui-serif, serif',
            }}
          >
            {title.split("").map((c, i) => (
              <span
                key={i}
                data-char
                className="inline-block will-change-transform py-1 px-[2px] shimmer-text"
                style={
                  {
                    "--delay": `${i * 0.15}s`,
                  } as React.CSSProperties
                }
              >
                {c}
              </span>
            ))}
          </span>

          <motion.span
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              delay: 2.3,
              type: "spring",
              stiffness: 180,
              damping: 16,
            }}
            className="font-bold text-lumen text-[clamp(2rem,8.5vw,6.5rem)]"
            style={{
              fontFamily: '"Playfair Display", ui-serif, serif',
            }}
          >
            2026
          </motion.span>
        </h1>

        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.55, duration: 0.6 }}
        >
          Registrations &amp; Payments Closed — Teams Finalized
        </motion.p>

        {/* Main Hero Message */}
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.7, duration: 0.7 }}
          className="mt-4 max-w-3xl font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tightest text-fg"
        >
          The Wait is Almost Over.
        </motion.h2>

        {/* Welcome Message */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.95, duration: 0.65 }}
          className="mt-5 max-w-2xl font-display text-base md:text-xl text-slate-200 leading-relaxed tracking-tight"
        >
          Welcome to{" "}
          <span className="text-lumen font-bold">
            SPECATHON 2026
          </span>
          .
        </motion.p>

        {/* Supporting Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.15, duration: 0.65 }}
          className="mt-2 max-w-2xl text-base md:text-lg font-medium text-slate-400 leading-relaxed"
        >
          Get ready to build. Create. Unleash your creativity.
        </motion.p>

        {/* Event Date */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3.35, duration: 0.6 }}
          className="mt-7"
        >
          <DateCounter value="11th & 12th SEP" startDelay={3500} />
        </motion.div>

        {/* Countdown Label */}

      </div>
    </section>
  );
}
