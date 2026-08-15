import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import Reveal from "./Reveal";

type Domain = {
  id: string;
  name: string;
  short: string;
  description: string;
  icon: string;      // path to custom PNG icon
  accent: string;    // text color class
  glow: string;      // rgba for glow
  pptUrl: string;
};

export const DOMAINS: Domain[] = [
  {
    id: "ai",
    name: "Artificial Intelligence",
    short: "AI & ML",
    description:
      "Build intelligent systems that learn, reason, and automate complex tasks using data and machine learning. Create solutions that transform industries through predictive analytics, computer vision, and generative AI.",
    icon: "/icons/artificial-intelligence.png",
    accent: "text-lumen",
    glow: "rgba(47,147,173, 0.55)",
    pptUrl: "#",
  },
  {
    id: "sec",
    name: "Cybersecurity",
    short: "Cybersecurity",
    description:
      "Develop innovative solutions to protect digital systems, networks, and sensitive information from cyber threats. Strengthen privacy, detect vulnerabilities, and build a safer digital future.",
    icon: "/icons/cyber-security.png",
    accent: "text-rose-400",
    glow: "rgba(244, 63, 94, 0.55)",
    pptUrl: "#",
  },
  {
    id: "data",
    name: "Data Science",
    short: "Data Science",
    description:
      "Turn raw data into meaningful insights through analytics, visualization, and predictive modeling. Solve real-world challenges by making data-driven decisions that create measurable impact.",
    icon: "/icons/data-science.png",
    accent: "text-blue-400",
    glow: "rgba(59, 130, 246, 0.55)",
    pptUrl: "#",
  },
  {
    id: "iot",
    name: "Internet of Things (IoT)",
    short: "Smart IoT",
    description:
      "Connect smart devices and sensors to collect, analyze, and exchange real-time data. Build intelligent ecosystems that improve automation, efficiency, and everyday experiences.",
    icon: "/icons/iot.png",
    accent: "text-purple-400",
    glow: "rgba(168, 85, 247, 0.55)",
    pptUrl: "#",
  },
  {
    id: "blockchain",
    name: "Blockchain",
    short: "Blockchain",
    description:
      "Create decentralized, secure, and transparent applications powered by blockchain technology. Explore smart contracts, digital identity, and trustless systems for the future of the web.",
    icon: "/icons/blockchain.png",
    accent: "text-indigo-400",
    glow: "rgba(99, 102, 241, 0.55)",
    pptUrl: "#",
  },
  {
    id: "autotech",
    name: "AutoTech",
    short: "AutoTech",
    description:
      "Reimagine the future of mobility with innovations in connected, electric, and autonomous vehicles. Develop smart transportation solutions that enhance safety, efficiency, and sustainability.",
    icon: "/icons/self-driving-car.png",
    accent: "text-amber-400",
    glow: "rgba(245, 158, 11, 0.55)",
    pptUrl: "#",
  },
  {
    id: "agriculture",
    name: "Agriculture",
    short: "Smart Farming",
    description:
      "Leverage technology to improve farming, crop monitoring, irrigation, and food production. Empower farmers with smart, sustainable solutions for a resilient agricultural future.",
    icon: "/icons/agriculture.png",
    accent: "text-green-400",
    glow: "rgba(34, 197, 94, 0.55)",
    pptUrl: "#",
  },
  {
    id: "waste",
    name: "Waste Management",
    short: "Sustainability",
    description:
      "Design innovative systems to reduce, recycle, and efficiently manage waste for cleaner communities. Promote sustainability through smart technologies that support a circular economy.",
    icon: "/icons/waste-management.png",
    accent: "text-emerald-400",
    glow: "rgba(16, 185, 129, 0.55)",
    pptUrl: "#",
  },
  {
    id: "low-poverty",
    name: "Low Poverty",
    short: "Low Poverty",
    description:
      "Develop technology-driven solutions aimed at alleviating poverty, empowering underprivileged communities, and expanding access to microfinance, employment opportunities, and essential resources for sustainable economic growth.",
    icon: "/icons/low poverty.png",
    accent: "text-teal-400",
    glow: "rgba(20, 184, 166, 0.55)",
    pptUrl: "#",
  },
  {
    id: "open",
    name: "Open Innovation",
    short: "Build Anything",
    description:
      "Think beyond predefined categories and bring any groundbreaking idea to life. Build creative, scalable solutions that solve real-world problems across any domain.",
    icon: "/icons/open innovation.png",
    accent: "text-pink-400",
    glow: "rgba(236, 72, 153, 0.55)",
    pptUrl: "#",
  },
];

const RADIUS = 40; // % from center to node

export default function Domains() {
  const reduce = useReducedMotion();
  const [activeId, setActiveId] = useState(DOMAINS[0].id);
  const activeIndex = DOMAINS.findIndex((d) => d.id === activeId);
  const active = DOMAINS[activeIndex];
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.1 });

  // Pre-compute node positions — these never change
  const nodePositions = useMemo(
    () =>
      DOMAINS.map((_, i) => {
        const angle = ((i / DOMAINS.length) * 360 - 90) * (Math.PI / 180);
        return {
          x: 50 + RADIUS * Math.cos(angle),
          y: 50 + RADIUS * Math.sin(angle),
        };
      }),
    []
  );

  // Angle for the pointer line: 0deg points right in CSS; start layout at top.
  const pointerAngle = (activeIndex / DOMAINS.length) * 360 - 90;

  return (
    <section ref={sectionRef} id="domains" className="relative py-14 md:py-20 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-16 max-w-2xl">
          <Reveal>
            <div className="eyebrow flex items-center gap-3">

            </div>
            <h2 className="mt-6 font-display text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Innovation Starts with a Choice.
              <span className="block font-serif italic text-plasma">Choose your domain</span>
            </h2>
            <p className="mt-6 text-muted text-sm max-w-md">

            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
          {/* ── Radial wheel ── */}
          <Reveal>
            <div
              className="relative mx-auto w-full max-w-[440px] aspect-square"
              role="radiogroup"
              aria-label="Problem domains"
            >
              {/* Rotating ambient rings */}
              <div className="absolute inset-0 rounded-full border border-white/[0.06]" />
              <div className="absolute inset-[12%] rounded-full border border-white/[0.05]" />
              {!reduce && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, transparent, ${active.glow}, transparent 40%)`,
                    maskImage: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
                    WebkitMaskImage: "radial-gradient(circle, transparent 62%, black 63%, black 66%, transparent 67%)",
                  }}
                  animate={isInView ? { rotate: 360 } : false}
                  transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                />
              )}

              {/* Pointer line from hub to active node */}
              <motion.div
                className="absolute left-1/2 top-1/2 h-px origin-left z-0"
                style={{
                  width: `${RADIUS}%`,
                  background: `linear-gradient(to right, ${active.glow}, transparent)`,
                }}
                animate={{ rotate: pointerAngle }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 120, damping: 18 }
                }
              />

              {/* Center hub */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 h-28 w-28 md:h-32 md:w-32 rounded-full glass flex flex-col items-center justify-center text-center">
                <div
                  className="absolute inset-0 rounded-full blur-xl -z-10 transition-colors duration-500"
                  style={{ background: active.glow, opacity: 0.25 }}
                />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active.id}
                    initial={reduce ? undefined : { opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center"
                  >
                    <div
                      className={`w-8 h-8 md:w-9 md:h-9 ${active.accent} filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
                      style={{
                        maskImage: `url("${active.icon}")`,
                        WebkitMaskImage: `url("${active.icon}")`,
                        maskSize: "contain",
                        WebkitMaskSize: "contain",
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                        maskPosition: "center",
                        WebkitMaskPosition: "center",
                        backgroundColor: "currentColor"
                      }}
                    />
                    <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.24em] text-muted px-2 text-center">
                      {active.short}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Nodes */}
              {DOMAINS.map((d, i) => {
                const { x, y } = nodePositions[i];
                const isActive = d.id === activeId;
                return (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={d.name}
                    onMouseEnter={() => setActiveId(d.id)}
                    onFocus={() => setActiveId(d.id)}
                    onClick={() => setActiveId(d.id)}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <motion.span
                      className={`h-11 w-11 flex items-center justify-center rounded-xl border backdrop-blur-md transition-colors duration-300 ${isActive
                        ? "border-white/25 bg-white/[0.08]"
                        : "border-white/10 bg-white/[0.03] hover:border-white/20"
                        }`}
                      initial={false}
                      animate={{
                        scale: isActive ? 1.15 : 1,
                        boxShadow: isActive ? `0 0 28px -4px ${d.glow}` : "0 0 0px rgba(0,0,0,0)",
                      }}
                      transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    >
                      <div
                        className={`w-6 h-6 transition-all duration-300 ${isActive
                          ? `${d.accent} drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]`
                          : `text-white/50 group-hover:${d.accent} group-hover:scale-105`
                          }`}
                        style={{
                          maskImage: `url("${d.icon}")`,
                          WebkitMaskImage: `url("${d.icon}")`,
                          maskSize: "contain",
                          WebkitMaskSize: "contain",
                          maskRepeat: "no-repeat",
                          WebkitMaskRepeat: "no-repeat",
                          maskPosition: "center",
                          WebkitMaskPosition: "center",
                          backgroundColor: "currentColor"
                        }}
                      />
                    </motion.span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* ── Detail panel ── */}
          <Reveal delay={0.1}>
            <div className="relative rounded-3xl glass p-5 md:p-6 min-h-[220px] max-w-md flex flex-col">
              <div
                className="absolute -inset-px rounded-3xl opacity-40 blur-2xl -z-10 transition-colors duration-500"
                style={{ background: `radial-gradient(120px 120px at 20% 0%, ${active.glow}, transparent)` }}
              />
              <div className="flex-1 flex flex-col">
                <motion.div
                  key={active.id}
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted uppercase tracking-[0.28em]">
                      Domain / {String(activeIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <h3 className="mt-5 font-display text-3xl md:text-4xl tracking-tightest">
                    {active.name}
                  </h3>
                  <p className="mt-4 text-sm text-muted leading-relaxed">
                    {active.description}
                  </p>
                </motion.div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
