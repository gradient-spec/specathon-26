import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import gradientMarkUrl from "@/assets/gradient-mark-cutout.png";
import collegeCrestUrl from "@/assets/college-crest-cutout.png";
import { EVENT } from "@/constants/event";

/**
 * SPECATHON 2026 — Cinematic invitation opening.
 *
 * Plays automatically over the homepage's fixed overlay layer (the same
 * role the previous progress-bar Loader played): Hero mounts underneath
 * from t=0, the invitation covers it, then fades away — no second loading
 * state, no blank frame.
 *
 * PERFORMANCE NOTE (fixes the reported transition lag): an earlier version
 * of this component mounted a *second* <Particles /> canvas instance
 * inside the overlay to visually match the site background. Home.tsx
 * already renders one persistent <Particles /> instance behind everything
 * — so during the ~4s intro there were TWO independent
 * requestAnimationFrame loops each drawing ~95 twinkling stars plus
 * periodic meteor bursts (shadow-blur + gradient-stroke canvas ops),
 * competing for main-thread time right through the exit fade. That was
 * the actual cause of the laggy handoff, not the fade animation itself.
 *
 * BACKGROUND (must be identical to the website, not a lookalike): the
 * overlay uses `bg-void` + `.noise` — the exact same base color (#0B0F14)
 * and grain texture Hero/the rest of the site sit on, not an approximation.
 * It still needs to be opaque (Hero is fully mounted right underneath it),
 * so rather than mounting a second Particles canvas to fake the starfield
 * on top of it (the old, laggy approach — see PERFORMANCE NOTE above),
 * Home.tsx's single persistent <Particles /> instance is temporarily
 * elevated (via its `elevated` prop) to paint ABOVE this overlay for as
 * long as the invitation is on screen, then drops back behind the page
 * content the moment it's gone (InvitationIntro's `onComplete` callback).
 * Same one canvas, same one rAF loop, the whole time — just a z-index
 * toggle — so the stars/meteors read as continuous and uninterrupted
 * across the invitation → Hero handoff.
 *
 * Logos: real, already-in-production assets —
 *   - src/assets/gradient-mark-cutout.png (compact mark) — top-left corner
 *   - src/assets/college-crest-cutout.png — top-right corner
 *   - public/gradient-logo (2).png — the official Gradient mark + wordmark,
 *     already a white silhouette on a transparent background (no backing
 *     plate to remove). The source asset is a translucent light-gray mark
 *     (~rgb(226,226,226) @ ~52% alpha), not solid white — verified by
 *     sampling actual pixel data. brightness(0) + invert(1) recolors it to
 *     crisp pure white while leaving its alpha/antialiasing untouched. Two
 *     identical layers are stacked so the ~52%-alpha mark composites up to
 *     a clearly visible ~77% white (1-(1-.52)^2) instead of reading as a
 *     faint ghost. A soft, premium cyan/lumen bloom (GPU-composited
 *     drop-shadow, the same technique `.hero-title`'s glow uses) sits on
 *     the top layer only, kept subtle so it reads as ambient light rather
 *     than neon.
 *
 * Event details: EVENT.venue/tagline and the site's existing
 * "11th & 12th September" date convention (constants/event.js) — nothing
 * invented.
 */

const REDUCED_EXIT_DELAY_MS = 1100;
// Reveal completes ~3.15s in (last phase — venue — finishes at delay 2.75s
// + duration 0.4s); HOLD_MS keeps it fully static (no motion running) for
// ~2.5s before the exit begins, per spec: reveal (~3-4s) → hold (~2-3s) →
// smooth fade transition.
const REVEAL_COMPLETE_MS = 3150;
const HOLD_MS = 2500;
const FULL_EXIT_DELAY_MS = REVEAL_COMPLETE_MS + HOLD_MS;
const EXIT_DURATION_S = 0.6;
// A plain-timer fallback that unmounts shortly after the exit animation
// should have finished, so completion never depends solely on Framer
// Motion's onExitComplete firing (which is internally rAF-driven and can
// stall if the tab is backgrounded/throttled) — belt-and-suspenders so the
// intro can never get stuck on screen.
const EXIT_FALLBACK_BUFFER_MS = 600;

export default function InvitationIntro({ onComplete }: { onComplete?: () => void }) {
  const reduce = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const delay = reduce ? REDUCED_EXIT_DELAY_MS : FULL_EXIT_DELAY_MS;
    const id = window.setTimeout(() => setExiting(true), delay);
    return () => window.clearTimeout(id);
  }, [reduce]);

  useEffect(() => {
    if (!exiting) return;
    const id = window.setTimeout(() => setGone(true), EXIT_DURATION_S * 1000 + EXIT_FALLBACK_BUFFER_MS);
    return () => window.clearTimeout(id);
  }, [exiting]);

  useEffect(() => {
    if (gone) onComplete?.();
  }, [gone, onComplete]);

  if (gone) return null;

  // Reduced-motion: every phase appears together, near-instantly, with only
  // a short fade — content is preserved, choreography is not.
  const d = (full: number) => (reduce ? 0.05 : full);

  return (
    <AnimatePresence onExitComplete={() => setGone(true)}>
      {!exiting && (
        <motion.div
          key="invitation-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 1.02 }}
          transition={{ duration: EXIT_DURATION_S, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[100] bg-void noise flex flex-col items-center justify-center overflow-hidden px-6"
          aria-hidden="true"
          data-invitation-intro=""
        >
          {/* Ambient glow — matches the Hero title's existing glow language.
              Static (no animation loop), so it costs nothing during the hold. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[65vh] w-[65vh] rounded-full bg-lumen/[0.06] blur-[130px]" />
          </div>

          {/* ── Phase 1 — institutional branding, top corners ─────────── */}
          <motion.img
            src={gradientMarkUrl}
            alt="Gradient — The Technical Club of CSE (AI & ML)"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 0.95, y: 0 }}
            transition={{ delay: d(0.15), duration: d(0.5), ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-5 left-5 sm:top-6 sm:left-6 md:top-9 md:left-9 h-8 sm:h-10 md:h-14 w-auto object-contain"
          />
          <motion.img
            src={collegeCrestUrl}
            alt="St. Peter's Engineering College"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 0.95, y: 0 }}
            transition={{ delay: d(0.15), duration: d(0.5), ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-5 right-5 sm:top-6 sm:right-6 md:top-9 md:right-9 h-8 sm:h-10 md:h-14 w-auto object-contain"
          />

          {/* Content block: centered via the parent's flex justify-center. */}
          <div className="relative flex flex-col items-center text-center max-w-3xl px-2">
            {/* ── Phase 2 — Gradient identity: the real logo, whitened ────
                Sized down from h-24/32/40 so it establishes organizer
                identity without competing with the (now larger) event
                title below. */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(0.6), duration: d(0.6), ease: [0.22, 1, 0.36, 1] }}
              className="relative h-16 sm:h-20 md:h-24 w-auto"
            >
              <img
                src="/gradient-logo%20(2).png"
                alt=""
                aria-hidden="true"
                className="h-16 sm:h-20 md:h-24 w-auto object-contain"
                style={{ filter: "brightness(0) invert(1)" }}
              />
              <img
                src="/gradient-logo%20(2).png"
                alt="Gradient — The Technical Club of CSE (AI & ML)"
                className="absolute inset-0 h-16 sm:h-20 md:h-24 w-auto object-contain"
                style={{
                  filter:
                    "brightness(0) invert(1) drop-shadow(0 0 12px rgba(47,147,173,0.4)) drop-shadow(0 0 26px rgba(47,147,173,0.2))",
                }}
              />
            </motion.div>
            {/* Gradient wordmark — bound to the logo above (moderate gap)
                so the two still read as one organizer-identity group. */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(0.8), duration: d(0.5), ease: [0.22, 1, 0.36, 1] }}
              className="mt-3 sm:mt-4 font-display font-semibold text-lg sm:text-xl md:text-2xl text-lumen tracking-tight"
            >
              The Technical Club of CSE (AI &amp; ML)
            </motion.p>

            {/* ── Phase 3 — subordinate invite line ─────────────────────── */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(1.2), duration: d(0.5), ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 sm:mt-7 md:mt-8 font-display italic text-base md:text-lg text-slate-400 tracking-tight"
            >
              invites you to
            </motion.p>

            {/* ── Phase 4 — SPECATHON 2026, the main event title ───────────
                The dominant element: increased from clamp(1.6rem,7.8vw,
                4.75rem) to clamp(2.25rem,9.5vw,5.75rem). whitespace-nowrap
                removed — at the very smallest phone widths (~320px) it may
                wrap once, cleanly between "SPECATHON" and "2026" (a normal
                space, not a forced break), never mid-word; from ~375px up
                it renders on one line. */}
            <motion.h1
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: d(1.75), duration: d(0.65), ease: [0.22, 1, 0.36, 1] }}
              className="hero-title mt-6 sm:mt-7 md:mt-8 font-display font-bold leading-[1.05] text-[clamp(2rem,8.5vw,5.25rem)] tracking-tightest"
              style={{ fontFamily: '"Playfair Display", ui-serif, serif' }}
            >
              SPECATHON <span className="text-lumen">2026</span>
            </motion.h1>

            {/* ── Phase 5 — hackathon description ─────────────────────── */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(2.3), duration: d(0.45), ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 sm:mt-8 font-display text-xs sm:text-sm md:text-base text-slate-300 tracking-tight"
            >
              A 36 Hour National Level Hackathon
            </motion.p>

            {/* ── Phase 6 — event date + venue ───────────────────────────── */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(2.6), duration: d(0.4), ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 sm:mt-6 font-mono text-[11px] md:text-xs tracking-[0.24em] uppercase text-slate-200"
            >
              11th &amp; 12th September 2026
            </motion.p>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d(2.75), duration: d(0.4), ease: [0.22, 1, 0.36, 1] }}
              className="mt-2.5 font-mono text-[9px] md:text-[11px] tracking-[0.2em] uppercase text-slate-400"
            >
              {EVENT.venue}
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
