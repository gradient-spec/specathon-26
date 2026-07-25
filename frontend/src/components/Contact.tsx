import { motion } from "framer-motion";
import Reveal from "./Reveal";

type Coordinator = {
  role: string;
  kind: "Faculty" | "Student";
  name: string;
  title: string;
  phone: string;
  email: string;
};

const COORDINATORS: Coordinator[] = [
  {
    role: "President",
    kind: "Student",
    name: "M Anusha",
    title: "",
    phone: "9703732604",
    email: "23bk1a6632@stpetershyd.com",
  },
  {
    role: "Admin",
    kind: "Student",
    name: "G Shubhang",
    title: "",
    phone: "8125426303",
    email: "23bk1a66t0@stpetershyd.com",
  },
];

export default function Contact() {
  return (
    <section id="contact" className="relative py-14 md:py-20">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-14 max-w-2xl">
          <Reveal>
            <div className="eyebrow flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-lumen font-medium">

              </span>
            </div>
            <h2 className="mt-4 font-display text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Queries? <span className="font-serif italic text-lumen">Contact us</span>.
            </h2>
            <p className="mt-4 text-muted text-sm max-w-md">

            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {COORDINATORS.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.08}>
              <Card c={c} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Card({ c }: { c: Coordinator }) {
  return (
    <motion.div
      data-cursor
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="group relative rounded-3xl glass p-8 overflow-hidden border border-white/10 hover:border-lumen/40 hover:shadow-[0_0_30px_rgba(74,203,235,0.18)] transition-all duration-300"
    >
      <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-lumen/10 blur-3xl opacity-40 group-hover:opacity-80 transition-opacity duration-500 pointer-events-none" />

      <div>
        <div className="font-display text-2xl md:text-3xl tracking-tight text-fg group-hover:text-white transition-colors duration-300">
          {c.name}
        </div>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-lumen font-semibold">
          {c.role}
        </div>
        {c.title && <div className="mt-1 text-sm text-muted">{c.title}</div>}
      </div>

      <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-col gap-3">
        <a
          href={`tel:${c.phone}`}
          className="text-sm text-fg/80 hover:text-lumen transition-colors inline-flex items-center gap-2"
        >
          <span className="font-mono text-xs text-muted">Phone:</span>
          <span className="font-mono text-fg font-medium">+91 {c.phone}</span>
        </a>
        <a
          href={`mailto:${c.email}`}
          className="text-sm text-fg/80 hover:text-lumen transition-colors inline-flex items-center gap-2 break-all"
        >
          <span className="font-mono text-xs text-muted">Email:</span>
          <span className="font-mono text-fg font-medium">{c.email}</span>
        </a>
      </div>
    </motion.div>
  );
}
