export default function Footer() {
  return (
    <footer className="relative border-t border-line/60 py-4 overflow-hidden">
      <div className="absolute inset-x-0 -top-24 h-[100px] bg-gradient-to-b from-lumen/[0.04] to-transparent blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 md:px-10">
        {/* Bottom bar: © left · Department centered · Powered by Gradient right —
            stacks centered on mobile, aligns into three columns from sm+ */}
        <div className="flex flex-col items-center gap-2 text-center sm:grid sm:grid-cols-3 sm:items-center sm:gap-4 sm:text-left">
          <span className="font-mono text-[10px] sm:text-[11px] text-muted tracking-[0.18em] sm:tracking-[0.24em] shrink-0">
            © SPECATHON 2026
          </span>

          <span className="font-mono text-[10px] sm:text-[11px] text-muted tracking-[0.18em] sm:tracking-[0.24em] sm:text-center">
            Department of CSE (AI&amp;ML)
          </span>

          <a
            href="https://www.linkedin.com/company/spec-gradient-club/"
            target="_blank"
            rel="noopener noreferrer"
            data-cursor
            className="group flex items-center justify-center gap-1.5 sm:justify-end sm:gap-2.5 text-[10px] sm:text-[11px] text-muted hover:text-fg transition-colors shrink-0"
            aria-label="Powered by Gradient"
          >
            <span className="font-mono tracking-[0.18em] sm:tracking-[0.24em] uppercase">Powered by:</span>
            <img
              src="/footer logo.png"
              alt="Gradient Club"
              className="h-5 sm:h-6 md:h-7 w-auto object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
