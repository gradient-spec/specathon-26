import PhotoBooth from "./PhotoBooth";
import Reveal from "./Reveal";
import { Camera } from "lucide-react";

/**
 * Embedded photobooth section for the homepage.
 * Sits below Shortlisted Teams, above FAQs.
 * Uses the same section pattern as ShortlistedTeamsSection.
 */
export default function PhotoBoothSection() {
  return (
    <section id="photobooth" className="relative py-14 md:py-20 scroll-mt-16">
      <div className="mx-auto max-w-2xl px-6 md:px-10">
        {/* Section header */}
        <Reveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <Camera size={11} />
              Digital Photobooth
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.1] tracking-tightest">
              Capture Your{" "}
              <span className="font-serif italic text-lumen">Hackathon Moment</span>
            </h2>
            <p className="mt-5 text-muted text-sm md:text-base leading-relaxed max-w-md mx-auto">
              Strike a pose. Pick a frame. Share the experience.
            </p>
          </div>
        </Reveal>

        {/* Photobooth — centered, constrained to polaroid width */}
        <div className="flex justify-center">
          <PhotoBooth />
        </div>
      </div>
    </section>
  );
}
