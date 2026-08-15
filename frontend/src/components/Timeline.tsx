import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DoorOpen, Mic, Rocket, Users, Moon, Coffee, Snowflake, Gavel, Trophy, type LucideIcon } from "lucide-react";
import Reveal from "./Reveal";

type Slot = { time: string; title: string; note: string; icon: LucideIcon };
type Day = { id: string; label: string; date: string; slots: Slot[] };

const AGENDA: Day[] = [
  {
    id: "day1",
    label: "Day 1",
    date: "September 11, 2026",
    slots: [
      { time: "08:30 AM", title: "Reporting & Check-in", note: "Badges, kits, and breakfast at Gate 2.", icon: DoorOpen },
      { time: "10:00 AM", title: "Opening Keynote", note: "Inauguration, rules, and the tone for 36 hours.", icon: Mic },
      { time: "11:00 AM", title: "Hack Commences", note: "The clock starts. Build begins.", icon: Rocket },
      { time: "05:00 PM", title: "Mentorship Round 1", note: "Domain mentors visit every team.", icon: Users },
      { time: "12:00 AM", title: "Midnight Jam", note: "Energy boost, music, and midnight snacks.", icon: Moon },
    ],
  },
  {
    id: "day2",
    label: "Day 2",
    date: "September 12, 2026",
    slots: [
      { time: "03:00 AM", title: "Late-Night Fuel", note: "Coffee, snacks, and quiet keyboards.", icon: Coffee },
      { time: "09:00 AM", title: "Mentorship Round 2", note: "Final guidance before the freeze.", icon: Users },
      { time: "01:00 PM", title: "Code Freeze", note: "Commit what you have. Pencils down.", icon: Snowflake },
      { time: "02:30 PM", title: "Grand Jury Pitching", note: "Demos to the jury. Five minutes each.", icon: Gavel },
      { time: "05:30 PM", title: "Valedictory Ceremony", note: "Winners, awards, and a very long nap.", icon: Trophy },
    ],
  },
];

export default function Timeline() {
  const [active, setActive] = useState(0);
  const day = AGENDA[active];

  return (
    <section id="timeline" className="relative py-24 md:py-32 overflow-hidden scroll-mt-16">
      <div className="mx-auto max-w-4xl px-6 md:px-10">
        <Reveal>
          <div className="text-center mb-10">
            <div className="eyebrow inline-flex items-center gap-2 mb-4">Run of show</div>
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              36-Hour <span className="text-lumen">Interactive Agenda</span>
            </h2>
          </div>
        </Reveal>

        {/* Tabs */}
        <Reveal delay={0.06}>
          <div className="flex items-center justify-center gap-2 mb-10">
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

        {/* Slots */}
        <AnimatePresence mode="wait">
          <motion.ol
            key={day.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute left-[26px] md:left-[92px] top-3 bottom-3 w-px bg-gradient-to-b from-transparent via-lumen/40 to-transparent" />
            {day.slots.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="relative flex gap-5 md:gap-8 py-4 group">
                  <div className="hidden md:block w-[72px] shrink-0 text-right pt-2.5">
                    <div className="font-mono text-sm tabular-nums text-fg">{s.time}</div>
                  </div>
                  <div className="relative flex flex-col items-center pt-1">
                    <span className="h-10 w-10 rounded-full bg-void border-2 border-lumen/60 group-hover:border-lumen flex items-center justify-center text-lumen shadow-[0_0_18px_-4px_rgba(47,147,173,0.6)] transition-colors z-10">
                      <Icon size={15} />
                    </span>
                  </div>
                  <div className="flex-1 rounded-2xl glass p-4 md:p-5 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:border-lumen/30">
                    <div className="md:hidden font-mono text-xs text-muted mb-1">{s.time}</div>
                    <div className="font-display text-lg md:text-xl tracking-tight">{s.title}</div>
                    <div className="mt-1 text-sm text-subtle leading-relaxed">{s.note}</div>
                  </div>
                </li>
              );
            })}
          </motion.ol>
        </AnimatePresence>
      </div>
    </section>
  );
}
