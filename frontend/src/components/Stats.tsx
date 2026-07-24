import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import Reveal from "./Reveal";

/* Highlights — count-up metrics that animate when the section enters view. */
const STATS = [
  { prefix: "", to: 50, suffix: "K+", label: "Impressions on Unstop" },
  { prefix: "", to: 60, suffix: "K", label: "Prize Pool" },
  { prefix: "", to: 500, suffix: "+", label: "Participants" },
  { prefix: "", to: 5, suffix: "+", label: "Years of Legacy" },
];

function CountUp({ to, duration = 1.6 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  // Read the media query once — it never changes during a session
  const reduce = useRef(
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ).current;
  const [n, setN] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView || reduce) {
      setN(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / (duration * 1000));
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, to, duration]);

  return <span ref={ref}>{n}</span>;
}

export default function Stats() {
  return (
    <section id="stats" className="relative py-10 md:py-16">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div
                data-cursor
                className="group relative rounded-2xl glass p-6 md:p-8 h-full text-center transition-all duration-500 hover:-translate-y-1 hover:border-lumen/30"
              >
                <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-lumen/15 to-transparent blur-xl -z-10" />
                <div className="font-mono text-4xl md:text-5xl tracking-tightest text-fg tabular-nums">
                  {s.prefix}
                  <CountUp to={s.to} />
                  {s.suffix}
                </div>
                <div className="mt-3 text-xs md:text-sm uppercase tracking-[0.18em] text-muted">
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
