import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

export default memo(function Reveal({
  children,
  delay = 0,
  y = 24,
  x = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  x?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        // Subtle spring/elastic bounce for section entrances.
        opacity: { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay },
        y: { type: "spring", stiffness: 90, damping: 15, delay },
        x: { type: "spring", stiffness: 90, damping: 15, delay },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
});
