import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const links: { id: string; label: string }[] = [
  { id: "about", label: "About" },
  { id: "gallery", label: "Gallery" },
  { id: "domains", label: "Domains" },
  { id: "timeline", label: "Timeline" },
  { id: "faq", label: "FAQ" },
  { id: "contact", label: "Contact" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => {
    let rafId = 0;
    let pending = false;

    const update = () => {
      pending = false;
      const scrollY = window.scrollY;
      setScrolled(scrollY > 80);
      const heroBtn = document.getElementById("hero-register-btn");
      if (heroBtn) {
        setShowRegister(heroBtn.getBoundingClientRect().bottom < 64);
      } else {
        setShowRegister(scrollY > 500);
      }
    };

    const onScroll = () => {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    update(); // run once on mount to set initial state
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <>
      <motion.header
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? "backdrop-blur-xl bg-void/60 border-b border-white/[0.05]" : ""
          }`}
      >
        <div className="mx-auto max-w-[1400px] px-4 md:px-8 h-16 flex items-center justify-between gap-3">
          {/* Left — wordmark */}
          <div className="flex items-center gap-3 shrink-0 min-w-0">
            <a href="https://gradientclub.in" aria-label="SPECATHON x GRADIENT" className="group flex items-center gap-2.5 shrink-0">
              <AnimatePresence mode="wait">
                {scrolled ? (
                  <motion.div
                    key="scrolled-logo"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center gap-2.5"
                  >
                    <span className="font-display font-bold italic text-sm md:text-base tracking-widest flex items-center">
                      {"SPECATHON".split("").map((c, i) => (
                        <span
                          key={i}
                          className={`inline-block ${c === "." ? "text-lumen font-black" : "shimmer-text"}`}
                          style={c === "." ? undefined : ({ "--delay": `${i * 0.15}s` } as React.CSSProperties)}
                        >
                          {c}
                        </span>
                      ))}
                    </span>
                    <span className="font-mono text-xl font-semibold text-lumen/80 px-0.5">x</span>
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
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="hidden sm:inline font-display text-sm tracking-widest text-fg group-hover:text-lumen transition-colors"
                  >
                    GRADIENT
                  </motion.span>
                )}
              </AnimatePresence>
            </a>
          </div>

          {/* Right — scroll-in Register + SPEC logo + menu */}
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <a
              href="https://spechyd.ac.in"
              aria-label="SPEC"
              className="hidden md:flex items-center gap-2 pr-3 border-r border-white/10 text-fg/85 group"
            >
              <Logo variant="spec" size={26} />
              <span className="font-display text-sm tracking-widest group-hover:text-lumen transition-colors">
                SPEC
              </span>
            </a>

            <AnimatePresence>
              {showRegister && (
                <motion.a
                  href="#register"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="hidden md:inline-flex btn-primary !px-5 !py-2 text-[13px]"
                >
                  Register Now
                </motion.a>
              )}
            </AnimatePresence>

            {/* Mobile menu */}
            <button aria-label="Open menu" onClick={() => setOpen(true)} className="md:hidden text-fg p-2">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </motion.header>

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
                <Logo variant="spec" size={26} />
                <span className="font-display text-sm tracking-widest">SPECATHON</span>
              </div>
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-2">
                <X size={20} />
              </button>
            </div>

            <nav className="flex flex-col gap-2 px-6 py-10">
              {links.map((l, i) => (
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

              <a href="#register" onClick={() => setOpen(false)} className="btn-primary self-start mt-8">
                Register your team
              </a>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
