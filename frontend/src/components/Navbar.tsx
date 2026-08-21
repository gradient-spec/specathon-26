import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Logo } from "./Logo";

const links: { id: string; label: string }[] = [
  { id: "top", label: "Home" },
  { id: "gallery", label: "Gallery" },
  { id: "timeline", label: "Timeline" },
  { id: "shortlisted", label: "Shortlisted Teams" },
  { id: "faq", label: "FAQs" },
  { id: "contact", label: "Contact" },
];

export default function Navbar({
  hideShortlist = false,
}: {
  hideShortlist?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let ticking = false;

    const updateNavbarState = () => {
      const btn = document.getElementById("check-shortlist-btn");

      // If the shortlist button is not present, don't guess a scroll
      // position. Keep the current navbar state unchanged.
      if (!btn) {
        ticking = false;
        return;
      }

      // The navbar is 64px tall (h-16).
      // State 2 begins as soon as the TOP of the
      // "CHECK SHORTLIST STATUS" button crosses this boundary.
      const navbarHeight = 64;

      const shouldBeScrolled =
        btn.getBoundingClientRect().top <= navbarHeight;

      setScrolled((current) => {
        if (current === shouldBeScrolled) {
          return current;
        }

        return shouldBeScrolled;
      });

      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateNavbarState);
        ticking = true;
      }
    };

    const handleResize = () => {
      updateNavbarState();
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    // Establish the correct initial navbar state.
    updateNavbarState();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          delay: 1.6,
          duration: 0.6,
          ease: [0.22, 1, 0.36, 1],
        }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          scrolled
            ? "backdrop-blur-xl bg-void/60 border-b border-white/[0.05]"
            : ""
        }`}
      >
        <div className="mx-auto max-w-[1400px] px-4 md:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left — wordmark */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <a
              href="https://gradientclub.in"
              aria-label="SPECATHON x GRADIENT"
              className="group flex items-center gap-2.5 shrink-0 min-w-0"
            >
              {/* Mobile */}
              <div className="flex md:hidden items-center gap-1 min-w-0">
                {scrolled ? (
                  <>
                    <span className="font-display font-bold italic text-[11px] tracking-wide flex items-center shrink-0">
                      {"SPECATHON".split("").map((c, i) => (
                        <span
                          key={i}
                          className="inline-block shimmer-text"
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

                    <span className="font-mono text-xs font-semibold text-lumen/80 shrink-0">
                      x
                    </span>

                    <span className="font-display text-[11px] tracking-wide text-fg truncate">
                      GRADIENT
                    </span>
                  </>
                ) : (
                  <span className="font-display text-[11px] tracking-wide text-fg truncate">
                    GRADIENT
                  </span>
                )}
              </div>

              {/* Tablet / Desktop */}
              <div className="hidden md:block">
                <AnimatePresence mode="wait">
                  {scrolled ? (
                    <motion.div
                      key="scrolled-logo"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="flex items-center gap-2.5"
                    >
                      <span className="font-display font-bold italic text-sm md:text-base tracking-widest flex items-center">
                        {"SPECATHON".split("").map((c, i) => (
                          <span
                            key={i}
                            className="inline-block shimmer-text"
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

                      <span className="font-mono text-xl font-semibold text-lumen/80 px-0.5">
                        x
                      </span>

                      <span className="font-display text-sm tracking-widest text-fg group-hover:text-lumen transition-colors">
                        GRADIENT
                      </span>
                    </motion.div>
                  ) : (
                    <motion.span
                      key="top-logo"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{
                        duration: 0.35,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="font-display text-sm tracking-widest text-fg group-hover:text-lumen transition-colors"
                    >
                      GRADIENT
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </a>
          </div>

          {/* Right — SPEC logo + CTA + mobile menu */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a
              href="https://spechyd.ac.in"
              aria-label="SPEC"
              className="flex items-center gap-2 text-fg/85 group shrink-0"
            >
              <Logo
                variant="spec"
                size={40}
                className="h-6 sm:h-7 md:h-8 lg:h-10"
              />

              <span className="hidden sm:inline font-display text-sm tracking-widest group-hover:text-lumen transition-colors">
                SPEC
              </span>
            </a>

            {/* Desktop — Shortlisted Teams */}
            <AnimatePresence>
              {!hideShortlist && scrolled && (
                <motion.a
                  key="shortlist-cta"
                  href="#shortlisted"
                  initial={{
                    opacity: 0,
                    x: 12,
                    scale: 0.95,
                  }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    x: 12,
                    scale: 0.95,
                  }}
                  transition={{
                    duration: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="hidden md:inline-flex btn-primary cta-shimmer !px-5 !py-2 text-[13px] tracking-wide"
                >
                  SHORTLISTED TEAMS
                </motion.a>
              )}
            </AnimatePresence>

            {/* Mobile — Shortlisted Teams */}
            <AnimatePresence>
              {!hideShortlist && scrolled && (
                <motion.a
                  key="shortlist-cta-mobile"
                  href="#shortlisted"
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                  }}
                  transition={{
                    duration: 0.25,
                  }}
                  className="md:hidden inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-cyan-300"
                >
                  TEAMS
                </motion.a>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.header>

      {/* Mobile navigation overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-void/95 backdrop-blur-2xl md:hidden overflow-y-auto"
          >
            <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
              <div className="flex items-center gap-2.5">
                <Logo
                  variant="spec"
                  size={40}
                  className="h-7 md:h-8 lg:h-10"
                />

                <span className="font-display text-sm tracking-widest">
                  SPECATHON
                </span>
              </div>

              <button
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="p-2"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-2 px-6 py-10">
              {(hideShortlist
                ? links.filter((l) => l.id !== "shortlisted")
                : links
              ).map((l, i) => (
                <motion.a
                  key={l.id}
                  href={`#${l.id}`}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className="font-display text-3xl tracking-tight py-2 border-b border-white/5"
                >
                  {l.label}
                </motion.a>
              ))}

              {!hideShortlist && (
                <a
                  href="#shortlisted"
                  onClick={() => setOpen(false)}
                  className="btn-primary self-start mt-8"
                >
                  View Shortlisted Teams
                </a>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}