import { memo, useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Reveal from "./Reveal";
import Watermark from "./Watermark";
import { GALLERY } from "@/utils/assets";

const ITEMS =
  GALLERY.length > 0
    ? GALLERY
    : [
      { year: "2021", src: "" },
      { year: "2022", src: "" },
      { year: "2023", src: "" },
      { year: "2024", src: "" },
      { year: "2025", src: "" },
    ];

const N = ITEMS.length;
const DWELL_MS = 2000;

/** Nearest signed offset of i from active, wrapped for an infinite loop. */
function relOffset(i: number, active: number) {
  let rel = ((i - active) % N + N) % N;
  if (rel > N / 2) rel -= N;
  return rel;
}

export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.55 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused || !isInView) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % N), DWELL_MS);
    return () => window.clearInterval(id);
  }, [reduce, paused, isInView]);

  const go = useCallback((dir: number) => setActive((a) => (a + dir + N) % N), []);

  // Keyboard arrow keys navigation (ignoring text inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT" ||
          (activeEl as HTMLElement).isContentEditable);

      if (isInput) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [go]);

  return (
    <section ref={sectionRef} id="gallery" className="relative pt-0 pb-12 md:pt-0 md:pb-18 overflow-hidden">
      <Watermark />
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <Reveal>
          <div className="text-center">
            <div className="eyebrow inline-flex items-center gap-3">

            </div>
            <h2 className="mt-6 font-display text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Moments from <span className="font-serif italic text-lumen">Past Editions</span>
            </h2>
            <p className="mt-4 text-muted text-sm max-w-md mx-auto leading-relaxed">
              A look back at the energy, execution, and extreme ideas that defined our previous hackathons.
            </p>
          </div>
        </Reveal>
      </div>

      {/* Coverflow stage */}
      <div
        className="relative mt-14 h-[56vw] sm:h-[48vw] md:h-[42vw] lg:h-[36vw] max-h-[430px] min-h-[220px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {ITEMS.map((it, i) => {
          const rel = relOffset(i, active);
          const isActive = rel === 0;
          const abs = Math.abs(rel);
          const visible = abs <= 2;
          return (
            <motion.div
              key={it.year}
              className="absolute left-1/2 top-1/2 w-[86vw] sm:w-[74vw] md:w-[64vw] lg:w-[54vw] max-w-[650px] aspect-[16/9]"
              style={{ translate: "-50% -50%" }}
              initial={false}
              animate={{
                x: `${rel * 50}%`,
                scale: isActive ? 1 : abs === 1 ? 0.78 : 0.62,
                opacity: visible ? (isActive ? 1 : abs === 1 ? 0.7 : 0.35) : 0,
                filter: isActive ? "grayscale(0) brightness(1)" : "grayscale(1) brightness(0.7)",
                zIndex: 30 - abs * 10,
              }}
              transition={{ duration: reduce ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Slide year={it.year} src={it.src} active={isActive} />
            </motion.div>
          );
        })}

        {/* Controls */}
        <StageButton side="left" onClick={() => go(-1)} />
        <StageButton side="right" onClick={() => go(1)} />
      </div>

      {/* Dots */}
      <div className="mt-8 flex items-center justify-center gap-2">
        {ITEMS.map((it, i) => (
          <button
            key={it.year}
            aria-label={`Go to ${it.year}`}
            onClick={() => setActive(i)}
            className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? "w-8 bg-lumen" : "w-1.5 bg-white/25 hover:bg-white/50"
              }`}
          />
        ))}
      </div>
    </section>
  );
}

const Slide = memo(function Slide({ year, src, active }: { year: string; src: string; active: boolean }) {
  const [ok, setOk] = useState(Boolean(src));
  return (
    <div
      data-cursor
      className={`relative h-full w-full rounded-2xl glass overflow-hidden transition-shadow duration-500 ${active ? "shadow-[0_20px_60px_-20px_rgba(47,147,173,0.5)] ring-1 ring-lumen/30" : ""
        }`}
    >
      {ok ? (
        <img
          src={src}
          alt={`SPECATHON ${year}`}
          loading="lazy"
          onError={() => setOk(false)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-plasma/30 via-indigo/20 to-transparent">
          <div className="absolute inset-0 bg-grid [background-size:32px_32px] opacity-25" />
        </div>
      )}

    </div>
  );
});

function StageButton({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      aria-label={side === "left" ? "Previous" : "Next"}
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 z-40 h-11 w-11 rounded-full glass border border-white/10 flex items-center justify-center text-fg/80 hover:text-lumen hover:border-lumen/50 transition-all outline-none focus:outline-none focus-visible:outline-none active:outline-none ${side === "left" ? "left-4 md:left-10" : "right-4 md:right-10"
        }`}
    >
      {side === "left" ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
    </button>
  );
}
