import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Reveal from "@/components/Reveal";
import { Trophy } from "lucide-react";
import ShortlistedTeamsSection from "@/components/ShortlistedTeamsSection";

export default function ShortlistedTeams() {
  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 md:px-10 pt-28 pb-20">
        <Reveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <Trophy size={11} />
              Shortlist Results
            </div>
            <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tightest">
              Shortlist Results Are In
            </h1>
            <p className="mt-5 text-muted text-sm md:text-base leading-relaxed max-w-lg mx-auto">
              Shortlisted teams have been notified through their registered contact details.
              If your team has been selected, use your secure access link to view your shortlist status and complete the next step.
            </p>
          </div>
        </Reveal>

        <ShortlistedTeamsSection />
      </main>

      <Footer />
    </div>
  );
}
