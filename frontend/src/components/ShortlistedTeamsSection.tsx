import { useNavigate } from "react-router-dom";
import { ArrowRight, Trophy, Mail } from "lucide-react";
import Reveal from "@/components/Reveal";

interface ShortlistedTeamsSectionProps {
  embedded?: boolean;
}

export default function ShortlistedTeamsSection({ embedded = false }: ShortlistedTeamsSectionProps) {
  const navigate = useNavigate();

  const content = (
    <>
      {embedded && (
        <Reveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <Trophy size={11} />
              Shortlist Results
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.1] tracking-tightest">
              Shortlist Results Are In
            </h2>
            <p className="mt-5 text-muted text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
              Registrations are now closed. Shortlisted teams have been notified through their registered contact details. If your team has been selected, use your secure access link to view your shortlist status and complete the next step.
            </p>
          </div>
        </Reveal>
      )}

      <Reveal delay={embedded ? 0.08 : 0}>
        <div className="rounded-2xl border border-line bg-panel/20 p-6 md:p-8 text-center shadow-[0_0_30px_rgba(15,23,42,0.24)]">
          <p className="text-sm md:text-base text-fg leading-relaxed max-w-xl mx-auto">
            Shortlisted teams have been notified through their registered contact details.
            If your team has been selected, use your secure access link to view your shortlist status and complete the next step.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/shortlist/recover")}
              className="btn-primary"
            >
              Check Your Status
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate("/shortlist/recover")}
              className="btn-ghost"
            >
              <Mail size={15} />
              Recover Access
            </button>
          </div>
        </div>
      </Reveal>
    </>
  );

  if (embedded) {
    return (
      <section id="shortlisted" className="relative py-8 md:py-10 scroll-mt-16">
        <div className="mx-auto max-w-5xl px-6 md:px-10">
          {content}
        </div>
      </section>
    );
  }

  return <>{content}</>;
}
