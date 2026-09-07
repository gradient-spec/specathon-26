import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import DateCounter from "./DateCounter";
import SeatCountdown from "./SeatCountdown";

/**
 * Hero mounts immediately at t=0 (underneath the invitation overlay), but
 * its entrance animations must not run while it's hidden — otherwise by
 * the time the invitation fades out, Hero is already sitting in its final,
 * static state and the viewer never actually sees the opening sequence.
 *
 * `isActive` (passed by Home.tsx, flips false → true once
 * InvitationIntro's onComplete fires) gates this. The outer <section> and
 * its layout (min-h-[92svh] etc.) always render, so page height/scroll
 * stays stable throughout — only the entrance content (the animated title
 * chars + every motion.* element below) mounts for the first time once
 * isActive is true. That's deliberate: toggling an already-mounted
 * motion element's `animate` target from a value equal to its `initial`
 * doesn't reliably re-trigger in this Framer Motion version (verified —
 * the DOM stayed frozen at the initial inline style), whereas a genuine
 * mount always runs the initial→animate transition correctly, which is
 * the standard, well-tested path. Mounting it fresh here also means every
 * `transition.delay` below is counted from "isActive became true", i.e.
 * exactly when the invitation hands off — identical stagger/timing to
 * the original design, just correctly time-shifted.
 */
export default function Hero({ isActive = true }: { isActive?: boolean }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!isActive) return;
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
  }, [isActive]);

  const title = "SPECATHON";

  return (
    <section
      id="top"
      className="group relative min-h-[92svh] flex flex-col justify-center pt-24 pb-12 sm:pt-28 sm:pb-14 md:pt-32 md:pb-16 lg:pt-24 lg:pb-10 overflow-hidden noise"
    >
      <div className="relative mx-auto max-w-5xl w-full px-4 sm:px-6 md:px-10 flex flex-col items-center text-center">
        {isActive && (
          <>
            {/* Welcome wording introduces the existing animated wordmark. */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.95, duration: 0.65 }}
              className="mb-3 sm:mb-4 font-display text-base sm:text-lg md:text-xl text-slate-200 leading-relaxed tracking-tight"
            >
              Welcome to
            </motion.p>

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

            {/* Main Hero Message */}
            <motion.h2
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.7, duration: 0.7 }}
              className="mt-5 sm:mt-6 max-w-3xl font-display font-bold text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.1] tracking-tightest text-fg px-2"
            >
              The Wait is Almost Over.
            </motion.h2>

            {/* Supporting Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.15, duration: 0.65 }}
              className="mt-3 sm:mt-4 max-w-2xl text-sm sm:text-base md:text-lg font-medium text-slate-400 leading-relaxed px-2"
            >
              Get ready to build. Create. Unleash your creativity.
            </motion.p>

            {/* Event Date */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.35, duration: 0.6 }}
              className="mt-6 sm:mt-7 md:mt-8"
            >
              <DateCounter value="11th & 12th SEP" startDelay={3500} />
            </motion.div>

            <div className="mt-6 sm:mt-8 md:mt-10 w-full max-w-2xl px-2">
              <SeatCountdown inHero />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
