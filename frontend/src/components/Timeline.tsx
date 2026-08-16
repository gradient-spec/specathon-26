import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Reveal from "./Reveal";

type Slot = { time: string; title: string; note: string };
type Day = { id: string; label: string; date: string; slots: Slot[] };

const AGENDA: Day[] = [
  {
    id: "day1",
    label: "Day 1",
    date: "September 11, 2026",
    slots: [
      { time: "08:30 AM", title: "Reporting & Check-in", note: "Badges, kits, and breakfast at Gate 2." },
      { time: "10:00 AM", title: "Opening Keynote", note: "Inauguration, rules, and the tone for 36 hours." },
      { time: "11:00 AM", title: "Hack Commences", note: "The clock starts. Build begins." },
      { time: "05:00 PM", title: "Mentorship Round 1", note: "Domain mentors visit every team." },
      { time: "12:00 AM", title: "Midnight Jam", note: "Energy boost, music, and midnight snacks." },
    ],
  },
  {
    id: "day2",
    label: "Day 2",
    date: "September 12, 2026",
    slots: [
      { time: "03:00 AM", title: "Late-Night Fuel", note: "Coffee, snacks, and quiet keyboards." },
      { time: "09:00 AM", title: "Mentorship Round 2", note: "Final guidance before the freeze." },
      { time: "01:00 PM", title: "Code Freeze", note: "Commit what you have. Pencils down." },
      { time: "02:30 PM", title: "Grand Jury Pitching", note: "Demos to the jury. Five minutes each." },
      { time: "05:30 PM", title: "Valedictory Ceremony", note: "Winners, awards, and a very long nap." },
    ],
  },
];

export default function Timeline() {
  const [active, setActive] = useState(0);
  const day = AGENDA[active];

  return (
    <section id="timeline" className="relative py-8 md:py-10 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-3xl px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-6">
            {/* <div className="eyebrow inline-flex items-center gap-2 mb-4">Run of show</div> */}
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              36-Hour <span className="text-lumen">Interactive Agenda</span>
            </h2>
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal delay={0.06}>
          <div className="flex items-center justify-center gap-2 mb-8">
            {AGENDA.map((d, i) => (
              <button
                key={d.id}
                onClick={() => setActive(i)}
                className={`relative rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                  active === i ? "text-void" : "text-subtle hover:text-fg"
                }`}
              >
                {active === i && (
                  <motion.span
                    layoutId="agenda-tab"
                    className="absolute inset-0 rounded-full bg-plasma"
                    transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  />
                )}
                <span className="relative">{d.label} · {d.date.split(",")[0]}</span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* Checkpoints — clean single-column rail, no icons */}
        <AnimatePresence mode="wait">
          <motion.ol
            key={day.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Rail */}
            <div className="absolute left-[7px] top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-lumen/40 to-transparent" />

            {day.slots.map((s) => (
              <li key={s.title} className="relative pl-9 md:pl-12 pb-4 last:pb-0 group">
                {/* Node dot */}
                <span className="absolute left-[7px] top-[22px] -translate-x-1/2 h-3 w-3 rounded-full bg-void border-2 border-lumen/70 group-hover:border-lumen shadow-[0_0_14px_-3px_rgba(47,147,173,0.75)] transition-colors z-10" />

                <div className="rounded-2xl glass px-5 py-4 md:px-6 md:py-5 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-lumen/30">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-lg md:text-xl tracking-tight leading-snug">
                      {s.title}
                    </h3>
                    <span className="font-mono text-xs md:text-sm tabular-nums text-lumen shrink-0">
                      {s.time}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-subtle leading-relaxed">{s.note}</p>
                </div>
              </li>
            ))}
          </motion.ol>
        </AnimatePresence>
      </div>
    </section>
  );
}
