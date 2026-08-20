import React from "react";
import { Instagram, Mail, Linkedin } from "lucide-react";
import Reveal from "./Reveal";

function UnstopIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* letter 'u' */}
      <path d="M4.5 8v4.5a2.5 2.5 0 0 0 5 0V8" />
      {/* letter 'n' */}
      <path d="M14.5 12.5V8a2.5 2.5 0 0 1 5 0v4.5" />
    </svg>
  );
}

type SocialItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  hoverText: string;
  hoverBorder: string;
  glowBg: string;
  glowShadow: string;
};

const SOCIALS: SocialItem[] = [
  {
    icon: UnstopIcon,
    label: "Unstop",
    href: "https://unstop.com/p/specathon-2026-st-peters-engineering-college-1723868",
    hoverText: "group-hover:text-emerald-400",
    hoverBorder: "hover:border-emerald-500/60",
    glowBg: "bg-emerald-500/20",
    glowShadow: "hover:shadow-[0_0_25px_rgba(52,211,153,0.5)]",
  },
  {
    icon: (props) => <Instagram className={`h-5 w-5 ${props.className || ""}`} strokeWidth={2.4} />,
    label: "Instagram",
    href: "https://www.instagram.com/gradient_spec",
    hoverText: "group-hover:text-pink-400",
    hoverBorder: "hover:border-pink-500/60",
    glowBg: "bg-pink-500/20",
    glowShadow: "hover:shadow-[0_0_25px_rgba(244,114,182,0.5)]",
  },
  {
    icon: (props) => <Linkedin className={`h-5 w-5 ${props.className || ""}`} strokeWidth={2.4} />,
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/spec-gradient-club/",
    hoverText: "group-hover:text-sky-400",
    hoverBorder: "hover:border-sky-500/60",
    glowBg: "bg-sky-500/20",
    glowShadow: "hover:shadow-[0_0_25px_rgba(56,189,248,0.5)]",
  },
  {
    icon: (props) => <Mail className={`h-5 w-5 ${props.className || ""}`} strokeWidth={2.4} />,
    label: "Email",
    href: "mailto:gradient@stpetershyd.com",
    hoverText: "group-hover:text-red-400",
    hoverBorder: "hover:border-red-500/60",
    glowBg: "bg-red-500/20",
    glowShadow: "hover:shadow-[0_0_25px_rgba(248,113,113,0.5)]",
  },
];

export default function SocialMedia() {
  return (
    <section id="social" className="relative py-6 border-t border-white/[0.06] bg-transparent">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="flex flex-col md:flex-row items-center md:items-center justify-between text-center md:text-left gap-6">
          <Reveal>
            <div className="text-center md:text-left">
              <div className="font-mono text-xs uppercase tracking-[0.2em] text-lumen font-semibold">

              </div>
              <h3 className="mt-1 font-display text-2xl md:text-3xl tracking-tight">
                Social Media Handles
              </h3>
            </div>
          </Reveal>

          <div className="flex items-center justify-center gap-3 w-full md:w-auto">
            {SOCIALS.map((s, i) => (
              <Reveal key={s.label} delay={i * 0.06}>
                <a
                  href={s.href}
                  target={s.href.startsWith("mailto:") ? undefined : "_blank"}
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  data-cursor
                  className={`group relative h-12 w-12 rounded-2xl border border-white/10 flex items-center justify-center transition-all duration-300 ease-out bg-white/[0.03] hover:-translate-y-1 hover:scale-105 active:scale-95 ${s.hoverBorder} ${s.glowShadow}`}
                >
                  <span className={`pointer-events-none absolute inset-0 rounded-2xl ${s.glowBg} opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-300`} />
                  <s.icon className={`pointer-events-none relative z-10 h-5 w-5 text-fg/80 transition-colors duration-300 ${s.hoverText}`} />
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
