import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { EVENT } from "@/constants/event";

/**
 * SPECATHON 2026 — Cinematic invitation opening.
 *
 * Plays automatically over the homepage's fixed overlay layer: Hero mounts
 * underneath from t=0 but stays inert (see Hero.tsx's `isActive` gating)
 * until this component hands off, so there's never a second loading state
 * or a static Hero revealed underneath.
 *
 * TWO-CALLBACK HANDOFF (fixes the "blank pause after the invitation, then
 * Hero starts" gap): Hero's own entrance choreography has real internal
 * delays (title at +1.7s, eyebrow at +2.55s, etc. — all intentionally
 * preserved exactly as designed, counted from whenever `isActive` becomes
 * true). `onHeroActivate` fires at REVEAL_COMPLETE_MS — the instant the
 * hold begins, well before the exit fade even starts — so Hero mounts and
 * starts building its reveal *underneath the still-fully-opaque
 * invitation*, invisibly. By the time the invitation's exit fade actually
 * begins (~1.5s later) and finishes (~1.2s after that), Hero's title has
 * already been animating for ~1s+ and is visibly rising as the invitation
 * dissolves — a genuine overlapping crossfade with no dead gap after the
 * cut, instead of Hero only starting its own 1.7s ramp-up once the
 * invitation is already gone. `onComplete` still fires at full unmount and
 * continues to drive Particles' z-index handoff, unrelated to Hero's
 * timing.
 *
 * PERFORMANCE NOTE: an earlier version of this component mounted a
 * *second* <Particles /> canvas instance inside the overlay to visually
 * match the site background — that duplicated the starfield's
 * requestAnimationFrame loop and was the actual cause of a reported
 * transition lag. Home.tsx's single persistent <Particles /> instance is
 * temporarily elevated instead (via its `elevated` prop) to paint above
 * this overlay for as long as it's on screen — same one canvas the whole
 * time, just a z-index toggle.
 *
 * BACKGROUND: `bg-void` + `.noise` — the exact same base color (#0B0F14)
 * and grain texture the rest of the site sits on, not an approximation.
 *
 * Logo: only the Gradient mark — public/gradient-logo (2).png, the
 *   official Gradient mark + wordmark, a translucent light-gray mark
 *   (~52% alpha) on a transparent background, not solid white — verified
 *   by sampling actual pixel data. brightness(0) + invert(1) recolors it
 *   to crisp white while preserving its alpha/antialiasing; two stacked
 *   layers composite the ~52%-alpha mark up to a clearly visible ~77%
 *   white. A soft cyan/lumen bloom (the same drop-shadow technique
 *   `.hero-title`'s glow uses) sits on the top layer only. The college
 *   crest that previously sat alongside it has been removed — the
 *   invitation now leads with Gradient branding only.
 *
 * Event details: EVENT.venue/tagline and the site's existing
 * "11th & 12th September" date convention (constants/event.js) — nothing
 * invented. The venue is split across two lines (matching the requested
 * presentation) by splitting EVENT.venue on its comma, not by inventing
 * new copy.
 */

const REDUCED_EXIT_DELAY_MS = 1100;

// Reveal completes ~3.15s in (last phase — venue's second line — finishes
// at delay 2.8s + duration 0.35s); HOLD_MS keeps it fully static (no
// motion running) for ~1.5s before the exit begins, per spec: reveal
// (~3-4s) → brief hold (~1-2s) → smooth fade transition.
const REVEAL_COMPLETE_MS = 3150;
const HOLD_MS = 1500;
const FULL_EXIT_DELAY_MS = REVEAL_COMPLETE_MS + HOLD_MS;
const EXIT_DURATION_S = 0.6;

// A plain-timer fallback that unmounts shortly after the exit animation
// should have finished, so completion never depends solely on Framer
// Motion's onExitComplete firing (which is internally rAF-driven and can
// stall if the tab is backgrounded/throttled) — belt-and-suspenders so the
// intro can never get stuck on screen.
const EXIT_FALLBACK_BUFFER_MS = 600;

export default function InvitationIntro({
  onComplete,
  onHeroActivate,
}: {
  onComplete?: () => void;
  /** Fires at the start of the hold (REVEAL_COMPLETE_MS) — well before the
   * exit fade begins — so Hero can mount and start its own reveal while
   * still hidden behind the fully-opaque invitation. See the file-level
   * comment above for why this is timed this way. */
  onHeroActivate?: () => void;
}) {
  const reduce = useReducedMotion();
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const delay = reduce ? REDUCED_EXIT_DELAY_MS : REVEAL_COMPLETE_MS;
    const id = window.setTimeout(() => onHeroActivate?.(), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    const delay = reduce ? REDUCED_EXIT_DELAY_MS : FULL_EXIT_DELAY_MS;
    const id = window.setTimeout(() => setExiting(true), delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  useEffect(() => {
    if (!exiting) return;
    const id = window.setTimeout(
      () => setGone(true),
      EXIT_DURATION_S * 1000 + EXIT_FALLBACK_BUFFER_MS
    );
    return () => window.clearTimeout(id);
  }, [exiting]);

  useEffect(() => {
    if (gone) onComplete?.();
  }, [gone, onComplete]);

  if (gone) return null;

  // Reduced-motion: every phase appears together, near-instantly, with only
  // a short fade — content is preserved, choreography is not.
  const d = (full: number) => (reduce ? 0.05 : full);

  const venueLines = EVENT.venue.split(",").map((s) => s.trim());

  return (
    <AnimatePresence onExitComplete={() => setGone(true)}>
      {!exiting && (
        <motion.div
          key="invitation-intro"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: EXIT_DURATION_S,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed inset-0 z-[100] bg-void noise flex flex-col items-center justify-center overflow-hidden px-6"
          aria-hidden="true"
          data-invitation-intro=""
        >
          {/* Ambient glow — matches the Hero title's existing glow language.
              Static (no animation loop), so it costs nothing during the hold. */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[65vh] w-[65vh] rounded-full bg-lumen/[0.06] blur-[130px]" />
          </div>

          {/* Content block */}
          <div className="relative flex flex-col items-center text-center max-w-3xl mx-auto px-2">
            {/* ── ZONE: Gradient branding — logo only ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(0.5),
                duration: d(0.6),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative h-16 sm:h-20 md:h-24 w-auto shrink-0"
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

            {/* Club name */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(0.75),
                duration: d(0.5),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-3 sm:mt-4 shrink-0 font-display font-semibold text-lg sm:text-xl md:text-2xl text-lumen tracking-tight"
            >
              The Technical Club of CSE (AI &amp; ML)
            </motion.p>

            {/* Invitation phrase */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(1.15),
                duration: d(0.5),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-5 sm:mt-6 md:mt-7 shrink-0 font-display italic text-lg md:text-xl text-slate-400 tracking-tight"
            >
              invites you to
            </motion.p>

            {/* ── DOMINANT EVENT TITLE ─────────────────────────────────── */}
            <motion.h1
              initial={{ opacity: 0, y: 10, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                delay: d(1.7),
                duration: d(0.65),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="hero-title mt-5 sm:mt-6 md:mt-7 shrink-0 font-display font-bold leading-[1.05] text-[clamp(1.8rem,9vw,5.8rem)] tracking-tightest whitespace-nowrap"
              style={{
                fontFamily: '"Playfair Display", ui-serif, serif',
              }}
            >
              SPECATHON <span className="text-lumen">2026</span>
            </motion.h1>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(2.25),
                duration: d(0.45),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-2 sm:mt-3 shrink-0 font-display text-sm sm:text-base md:text-lg text-slate-300 tracking-tight"
            >
              A 36 Hour National Level Hackathon
            </motion.p>

            {/* Date */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(2.55),
                duration: d(0.4),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-5 sm:mt-6 shrink-0 font-mono text-xs md:text-sm tracking-[0.24em] uppercase text-slate-200"
            >
              11th &amp; 12th September 2026
            </motion.p>

            {/* Venue */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: d(2.7),
                duration: d(0.4),
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-2.5 shrink-0 font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-slate-400"
            >
              {venueLines[0]}
            </motion.p>

            {venueLines[1] && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: d(2.8),
                  duration: d(0.35),
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="mt-0.5 shrink-0 font-mono text-[10px] md:text-xs tracking-[0.2em] uppercase text-slate-400"
              >
                {venueLines[1]}
              </motion.p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}