/**
 * Two-part branding mark for the navbar.
 *
 * Uses an inline SVG placeholder by default. To swap in a real logo:
 *   1. Drop the file into `public/` (e.g. public/spec-logo.svg).
 *   2. Change the <Logo variant="spec" /> call to <Logo variant="spec" src="/spec-logo.svg" />.
 * The <img> path takes precedence when provided.
 */
export function Logo({
  variant,
  size = 24,
  src,
  alt,
  className,
}: {
  variant: "spec" | "stpeters";
  size?: number;
  src?: string;
  alt?: string;
  className?: string;
}) {
  const logoSrc = src || (variant === "spec" ? "/spec-logo-header.png" : undefined);
  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={alt ?? (variant === "spec" ? "SPEC" : "St. Peter's Engineering College")}
        width={size}
        height={size}
        className={`object-contain shrink-0 ${className ?? ""}`}
        style={className ? { width: "auto" } : { height: size, width: "auto" }}
      />
    );
  }
  return variant === "spec" ? <SpecMark size={size} /> : <StPetersMark size={size} />;
}

function SpecMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="specGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ACBEB" />
          <stop offset="1" stopColor="#186275" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="url(#specGrad)" strokeWidth="1.5" />
      <path d="M9 22V10h10a4 4 0 010 8h-6" stroke="url(#specGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22" cy="22" r="2" fill="#4ACBEB" />
    </svg>
  );
}

function StPetersMark({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id="spGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E0A83C" />
          <stop offset="1" stopColor="#CD8200" />
        </linearGradient>
      </defs>
      <path
        d="M16 2l12 5v9c0 7-5.4 12.8-12 14C9.4 28.8 4 23 4 16V7l12-5z"
        stroke="url(#spGrad)"
        strokeWidth="1.5"
        fill="rgba(245,184,65,0.06)"
      />
      <path d="M16 9v12M11 15h10" stroke="url(#spGrad)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
