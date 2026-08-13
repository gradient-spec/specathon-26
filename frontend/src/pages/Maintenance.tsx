import { ExternalLink } from "lucide-react";

export default function Maintenance() {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-plasma/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo/5 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center max-w-3xl mx-auto space-y-10">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/specathon-logo.png" 
            alt="SPECATHON 2026" 
            className="h-35 md:h:40 w-auto opacity-95 drop-shadow-2xl"
          />
        </div>

        {/* Title Section */}
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="eyebrow">SPECATHON 2026</div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tightest text-fg leading-tight">
               Website is Under Maintenance
            </h1>
          </div>

          {/* Message */}
          <div className="max-w-xl mx-auto space-y-4">
            <p className="text-lg md:text-xl text-fg/80 leading-relaxed">
              We're currently performing system maintenance to enhance your experience.
            </p>
            <p className="text-base md:text-lg text-muted leading-relaxed">
              In the meantime, you can continue accessing all event details, updates, and registration on our official Unstop page.
            </p>
          </div>
        </div>

        {/* Call-to-Action Button */}
        <div className="pt-6">
          <a
            href="https://unstop.com/hackathons/specathon-2026-st-peters-engineering-college-1723868"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-3 text-base md:text-lg px-8 py-4"
          >
            Visit SPECATHON on Unstop
            <ExternalLink size={20} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>

        {/* Additional Info */}
        <div className="pt-8 space-y-4">
          <div className="inline-block">
            <div className="h-px w-40 bg-gradient-to-r from-transparent via-line to-transparent rounded-full" />
          </div>
          <p className="text-sm text-muted/70">
            St. Peter's Engineering College
          </p>
        </div>
      </div>
    </div>
  );
}