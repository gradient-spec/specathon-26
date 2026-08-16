import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock } from "lucide-react";
import Reveal from "./Reveal";

/* Countdown to the Aug 31, 2026 seat-confirmation / payment deadline.
   Relocated out of the Hero to sit directly above the Shortlist portal. */
const DEADLINE = new Date("2026-08-31T23:59:59+05:30").getTime();

function useDeadline() {
  const [t, setT] = useState(() => Math.max(0, DEADLINE - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setT(Math.max(0, DEADLINE - Date.now())), 1000);
    return () => clearInterval(id);
  }, []);
  return {
    days: Math.floor(t / 86_400_000),
    hours: Math.floor((t % 86_400_000) / 3_600_000),
    minutes: Math.floor((t % 3_600_000) / 60_000),
    seconds: Math.floor((t % 60_000) / 1000),
  };
}

export default function SeatCountdown() {
  const { days, hours, minutes, seconds } = useDeadline();
  return (
    <section className="relative pt-16 pb-4 md:pt-20 md:pb-6">
      <div className="mx-auto max-w-5xl px-6 md:px-10 flex flex-col items-center text-center">
        <Reveal>
          <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold mb-3.5 inline-flex items-center gap-2">
            <Clock size={12} /> Seat Confirmation Deadline · Aug 31, 2026
          </div>
        </Reveal>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-stretch justify-center gap-2.5 md:gap-3.5"
        >
          <Cell label="Days" value={days} />
          <Cell label="Hours" value={hours} />
          <Cell label="Minutes" value={minutes} />
          <Cell label="Seconds" value={seconds} />
        </motion.div>
      </div>
    </section>
  );
}

/* Sleek high-contrast tile: dark surface, teal top-accent, oversized numerals. */
function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="relative rounded-2xl bg-[#0E141C] border border-line px-4 md:px-6 py-3.5 md:py-4 min-w-[70px] md:min-w-[96px] overflow-hidden shadow-[0_10px_30px_-16px_rgba(0,0,0,0.8)]">
      <span className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-lumen to-transparent" />
      <div className="font-mono text-4xl md:text-6xl font-bold tabular-nums tracking-tighter text-fg leading-none">
        {String(value).padStart(2, "0")}
      </div>
      <div className="mt-2 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.24em] text-subtle">
        {label}
      </div>
    </div>
  );
}
