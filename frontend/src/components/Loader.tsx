import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Loader() {
  const [pct, setPct] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 1400;
    const tick = (now: number) => {
      const p = Math.min(100, ((now - start) / dur) * 100);
      setPct(p);
      if (p < 100) raf = requestAnimationFrame(tick);
      else setTimeout(() => setGone(true), 350);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (gone) return null;

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: pct >= 100 ? 0 : 1 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] bg-void flex items-end justify-between px-6 md:px-12 py-8 pointer-events-none"
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
        SPEC · Systems Online
      </div>

      <div className="flex-1 mx-8 md:mx-16 h-px bg-white/10 relative overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-plasma via-lumen to-plasma"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="font-mono text-[10px] text-fg tabular-nums">
        {String(Math.floor(pct)).padStart(3, "0")}%
      </div>
    </motion.div>
  );
}
