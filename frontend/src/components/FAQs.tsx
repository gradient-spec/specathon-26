import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { MapPin, ArrowUpRight, Lock, ChevronDown } from "lucide-react";
import Reveal from "./Reveal";
import LineSidebar from "./LineSidebar";

type Faq = {
  q: string;
  a: string;
  venueUrl?: string;
};

const FAQS: Faq[] = [
  {
    q: "Where is the venue?",
    a: "SPECATHON 2026 is hosted live on-campus at St. Peter's Engineering College, Hyderabad. Parking is available at Gate 2, and student volunteers are stationed across campus to guide you.",
    venueUrl: "https://maps.google.com/?q=St.+Peter's+Engineering+College+Hyderabad",
  },
  {
    q: "How do payments work?",
    a: "A participation fee of ₹400 per head applies only after your project abstract is shortlisted. A secure online payment link will be sent directly to shortlisted team leads.",
  },
  {
    q: "Are fees refundable?",
    a: "Registration fees are strictly non-refundable once paid, as funds are immediately committed toward hacker kits, catering, swag bundles, and event arrangements.",
  },
  {
    q: "Is accommodation provided?",
    a: "Yes! Free campus accommodation is provided. Out-of-state participants can check in from 10th September, 4:00 PM. For all participants, stay & resting halls remain available until 12th September, 4:00 PM.",
  },
  {
    q: "Is food provided?",
    a: "Yes! Complimentary meals are served for all participants. On 11th September: Lunch, Refreshments, and Dinner are provided. On 12th September: Breakfast and Lunch are served on campus.",
  },
];

export default function FAQs() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [mobileActive, setMobileActive] = useState<number | null>(0);
  const current = FAQS[active];

  const handleHover = (index: number) => {
    if (!isLocked) {
      setActive(index);
    }
  };

  const handleClick = (index: number) => {
    if (isLocked && active === index) {
      setIsLocked(false);
    } else {
      setActive(index);
      setIsLocked(true);
    }
  };

  return (
    <section id="faq" className="relative py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-14 max-w-2xl">
          <Reveal>
            <div className="eyebrow flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-lumen font-medium">

              </span>
            </div>
            <h2 className="mt-4 font-display text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Answers, before you <span className="font-serif italic text-plasma">ask</span>
            </h2>
          </Reveal>
        </div>

        {/* Mobile Accordion Layout — Dropdown inside card with full glow effects */}
        <div className="block lg:hidden space-y-3.5">
          {FAQS.map((faq, idx) => {
            const isOpen = mobileActive === idx;
            return (
              <div
                key={faq.q}
                className={`relative rounded-2xl glass overflow-hidden transition-all duration-300 ${
                  isOpen
                    ? "border border-lumen/50 shadow-[0_0_30px_rgba(74,203,235,0.22)] bg-panel/90"
                    : "border border-white/10 hover:border-white/20"
                }`}
              >
                {/* Glow backdrop when open */}
                {isOpen && (
                  <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-lumen/20 blur-3xl pointer-events-none" />
                )}

                <button
                  onClick={() => setMobileActive(isOpen ? null : idx)}
                  className="w-full p-4 md:p-5 text-left flex items-center justify-between gap-3 font-display text-base md:text-lg tracking-tight text-fg hover:text-white"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-lumen shrink-0">
                      /{String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="leading-snug">{faq.q}</span>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-lumen shrink-0 transition-transform duration-300 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-3 border-t border-white/[0.08] bg-void/30 relative">
                        <div className="flex items-center gap-2 font-mono text-[11px] text-muted uppercase tracking-[0.28em] mb-2.5">
                          <span className="text-lumen">/{String(idx + 1).padStart(2, "0")}</span>
                          <span className="h-px w-6 bg-white/15" />
                          Answer
                        </div>
                        <p className="text-muted leading-relaxed text-sm">
                          {faq.a.replace("粒 ", "")}
                        </p>
                        {faq.venueUrl && (
                          <a
                            href={faq.venueUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium bg-gradient-to-r from-lumen/90 to-plasma/90 text-void hover:opacity-90 transition-opacity group"
                          >
                            <MapPin size={13} />
                            Open Venue
                            <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Desktop Split Layout — Preserved 100% unchanged for desktop */}
        <div className="hidden lg:grid grid-cols-[1.1fr_1fr] gap-8 lg:gap-14 items-start">
          {/* Line Sidebar list */}
          <Reveal>
            <div className="py-2">
              <LineSidebar
                items={FAQS.map((f) => f.q)}
                accentColor="#4ACBEB"
                textColor="#c4c4c4"
                markerColor="#186275"
                showIndex
                showMarker
                proximityRadius={120}
                maxShift={24}
                falloff="smooth"
                markerLength={50}
                markerGap={4}
                tickScale={0.4}
                scaleTick
                itemGap={16}
                fontSize={1.25}
                smoothing={120}
                defaultActive={0}
                activeItem={active}
                onItemClick={(index) => handleClick(index)}
                onItemHover={(index) => handleHover(index)}
              />
            </div>
          </Reveal>

          {/* Answer panel */}
          <Reveal delay={0.1}>
            <div className="relative rounded-3xl glass p-8 md:p-10 min-h-[280px] lg:sticky lg:top-24 border border-lumen/40 shadow-[0_0_45px_rgba(74,203,235,0.22),0_10px_30px_-10px_rgba(0,0,0,0.5)] bg-panel/80 overflow-hidden">
              <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-lumen/20 blur-3xl pointer-events-none" />
              <div>
                <motion.div
                  key={current.q}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted uppercase tracking-[0.28em]">
                      <span className="text-lumen">/{String(active + 1).padStart(2, "0")}</span>
                      <span className="h-px w-8 bg-white/15" />
                      Answer
                    </div>

                    {isLocked && (
                      <button
                        onClick={() => setIsLocked(false)}
                        data-cursor
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-lumen/15 text-lumen border border-lumen/40 hover:bg-lumen/25 transition-all duration-300 cursor-pointer shadow-[0_0_15px_rgba(74,203,235,0.25)]"
                        title="Question locked. Click to unlock hover preview."
                      >
                        <Lock size={12} className="text-lumen shrink-0" />
                        <span>Locked</span>
                        <span className="text-muted text-[10px] ml-0.5">(Unlock)</span>
                      </button>
                    )}
                  </div>
                  <h3 className="mt-5 font-display text-2xl md:text-3xl tracking-tightest">
                    {current.q}
                  </h3>
                  <p className="mt-4 text-muted leading-relaxed text-[15px]">
                    {current.a.replace("粒 ", "")}
                  </p>

                  {current.venueUrl && (
                    <a
                      href={current.venueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-8 inline-flex items-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium bg-gradient-to-r from-lumen/90 to-plasma/90 text-void hover:opacity-90 transition-opacity group"
                    >
                      <MapPin size={15} />
                      Open Venue
                      <ArrowUpRight size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                  )}
                </motion.div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
