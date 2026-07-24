/**
 * Central asset manifest.
 *
 * Drop the real files into /public with these exact names and they light up
 * across the site automatically. Until then, components fall back gracefully.
 *
 *   public/gradient-logo.png            → Gradient Club logo (footer + watermark)
 *   public/college-logo.png             → College logo (navbar + footer)
 *   public/specathon-ppt-template.pptx  → PPT template (Domains download)
 *   public/specathon-brochure.pdf       → Brochure (Hero download)
 *   public/gallery/2023.jpg …           → Past-event photos (Gallery)
 */

export const ASSETS = {
  gradientLogo: "/gradient-logo.png",
  collegeLogo: "/college-logo.png",
  pptTemplate: "/specathon-ppt-template.pptx",
  brochure: "/specathon-brochure.pdf",
};

/** Toggle these as files arrive so download buttons switch out of "coming soon". */
export const READY = {
  ppt: true,      // PPT template provided
  brochure: false, // Brochure not yet provided
};

/** Past-event gallery. Add/rename to match files in /public/gallery/. */
export const GALLERY: { year: string; src: string }[] = [
  { year: "Glimpse 5", src: "/gallery/glimpse-5.jpg" },
  { year: "Glimpse 1", src: "/gallery/glimpse-1.png" },
  { year: "Glimpse 2", src: "/gallery/glimpse-2.png" },
  { year: "Glimpse 3", src: "/gallery/glimpse-3.png" },
  { year: "Glimpse 4", src: "/gallery/glimpse-4.png" },
];
