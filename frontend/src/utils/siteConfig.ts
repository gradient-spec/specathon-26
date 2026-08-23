/**
 * Prepared, injectable content config for V2.
 *
 * These are clean, typed placeholders. When real data arrives, populate the
 * arrays/objects below — no component logic needs to change, sections can be
 * wired to read from here.
 */

export interface StatItem {
  /** Display value, e.g. "10K+", "₹50K", "500+". */
  value: string;
  /** Short label under the value. */
  label: string;
}

export interface FaqItem {
  q: string;
  a: string;
  /** Optional "Open Venue" style external link. */
  venueUrl?: string;
}

export interface MobileOverrides {
  /** Section ids to hide on small screens. */
  hideSections: string[];
  /** Render a compact countdown on mobile. */
  countdownCompact: boolean;
  /** Slides visible in the gallery on small screens. */
  galleryPerView: number;
  /** Escape hatch for ad-hoc responsive flags. */
  [key: string]: unknown;
}

/** Statistics / legacy metrics (populate when finalized). */
export const STATISTICS: StatItem[] = [
  // { value: "10K+", label: "Unstop Impressions" },
  // { value: "350+", label: "Participants" },
  // { value: "₹50K+", label: "Prize Pool" },
  // { value: "5+",   label: "Years of Legacy" },
];

/** FAQ entries (populate/override V1 defaults when needed). */
export const FAQS: FaqItem[] = [
  // { q: "Where is the venue?", a: "…", venueUrl: "https://maps.google.com/?q=…" },
];

/** Mobile-specific overrides. */
export const MOBILE_OVERRIDES: MobileOverrides = {
  hideSections: [],
  countdownCompact: false,
  galleryPerView: 1,
};
