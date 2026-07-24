import Reveal from "./Reveal";
import Watermark from "./Watermark";

/* ── TIMELINE STEPS — 5 key milestones leading to SPECATHON 2026 */
type Step = { day: string; title: string; note: string };

const STEPS: Step[] = [
  {
    day: "25th July 2026",
    title: "Registrations Start",
    note: "Official registration portal opens for all participating teams. Form your squad, select your preferred domain track, and begin drafting your project proposal.",
  },
  {
    day: "20th August 2026",
    title: "End of Registrations & Abstract Submissions",
    note: "Final deadline to complete team registration and submit your initial project abstract. Ensure all team member details and problem statement proposals are uploaded before midnight.",
  },
  {
    day: "25th August 2026",
    title: "Shortlisted Teams Announced",
    note: "Evaluation of submitted abstracts concludes. The official list of shortlisted teams qualified to compete in the main hackathon edition will be published.",
  },
  {
    day: "31st August 2026",
    title: "Registration Fee Payment Deadline",
    note: "Shortlisted teams must complete their seat confirmation and registration fee payment. Receive your official team confirmation pass and pre-hackathon guidelines.",
  },
  {
    day: "11th September 2026",
    title: "SPECATHON Begins",
    note: "The grand 36-hour hackathon officially kicks off! Doors open for check-ins, mentor sessions, overnight building, and live judging at the campus venue.",
  },
];

export default function Timeline() {
  return (
    <section id="timeline" className="relative py-12 md:py-18 overflow-hidden">
      <Watermark />
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <div className="text-center mb-16">
          <Reveal>
            <div className="eyebrow inline-flex items-center gap-3">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-lumen font-medium">

              </span>
            </div>
            <h2 className="mt-4 font-display text-4xl md:text-5xl leading-[1.05] tracking-tightest">
              Roadmap to <span className="font-serif italic text-lumen">SPECATHON</span>
            </h2>
            <p className="mt-4 text-muted text-sm max-w-md mx-auto leading-relaxed">

            </p>
          </Reveal>
        </div>

        <ol className="relative">
          {/* Central connector line */}
          <div className="absolute left-4 md:left-1/2 top-2 bottom-2 w-px md:-translate-x-1/2 bg-gradient-to-b from-transparent via-lumen/40 to-transparent" />

          {STEPS.map((s, i) => {
            const left = i % 2 === 0;
            return (
              <Reveal key={`${s.day}-${s.title}`} delay={0.04} x={left ? -24 : 24}>
                <li className="relative md:grid md:grid-cols-2 md:gap-x-12 pl-12 md:pl-0 pb-12 md:pb-10 last:pb-0 group">
                  {/* Node */}
                  <span
                    className={`absolute left-4 md:left-1/2 top-2 md:-translate-x-1/2 h-4 w-4 rounded-full z-10 transition-all duration-300 ${i === 0
                        ? "bg-lumen border-2 border-lumen shadow-[0_0_20px_rgba(74,203,235,0.8)]"
                        : "bg-[#0B0F17] border-2 border-lumen/70 shadow-[0_0_10px_rgba(74,203,235,0.25)]"
                      } group-hover:bg-lumen group-hover:border-lumen group-hover:scale-125 group-hover:shadow-[0_0_28px_rgba(74,203,235,1),0_0_50px_rgba(74,203,235,0.65)]`}
                  >
                    <span className="absolute -inset-1 rounded-full border border-lumen/60 opacity-0 group-hover:opacity-100 group-hover:animate-ping transition-opacity duration-300" />
                  </span>

                  {/* Card */}
                  <div className={left ? "md:col-start-1 md:text-right md:pr-6" : "md:col-start-2 md:pl-6"}>
                    <div className="rounded-2xl glass p-5 md:p-6 mb-4 md:mb-0 transition-all duration-500 hover:-translate-y-1.5 hover:border-lumen/60 hover:shadow-[0_0_35px_rgba(74,203,235,0.25),0_10px_30px_-10px_rgba(0,0,0,0.5)] hover:bg-panel/80 group-hover:border-lumen/50 cursor-pointer">
                      <div className={`flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-lumen font-semibold ${left ? "md:justify-end" : ""}`}>
                        <span>{s.day}</span>
                      </div>
                      <div className="mt-2 font-display text-xl md:text-2xl tracking-tight text-fg group-hover:text-white transition-colors duration-300">
                        {s.title}
                      </div>
                      <div className="mt-2 text-muted text-sm leading-relaxed group-hover:text-fg/90 transition-colors duration-300">
                        {s.note}
                      </div>
                    </div>
                  </div>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
