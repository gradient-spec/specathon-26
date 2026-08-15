import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Loader from "@/components/Loader";
import Cursor from "@/components/Cursor";
import Particles from "@/components/Particles";
import ShortlistPortal from "@/components/ShortlistPortal";
import PhotoBoothSection from "@/components/PhotoBoothSection";
import { useLenis } from "@/hooks/useLenis";

const Timeline = lazy(() => import("@/components/Timeline"));
const Gallery = lazy(() => import("@/components/Gallery"));
const Stats = lazy(() => import("@/components/Stats"));
const FAQs = lazy(() => import("@/components/FAQs"));
const Contact = lazy(() => import("@/components/Contact"));
const SocialMedia = lazy(() => import("@/components/SocialMedia"));
const Footer = lazy(() => import("@/components/Footer"));

/**
 * SPECATHON 2026 — V2 single-page structure.
 * Sequence: Hero → Shortlist Portal (+ QR Pass) → Photobooth → 36h Agenda →
 * Moments from Past Editions (gallery + legacy metrics).
 * Excluded per V2 spec: Domains grid, main Footer, Map & Support Desk (Contact).
 */
export default function Home() {
  useLenis();
  return (
    <>
      <Loader />
      <Cursor />
      <Particles />
      <Navbar />
      <main className="relative">
        {/* 1 — Hero: Shortlist announcement + Aug 31 deadline countdown */}
        <Hero />

        {/* 2 & 3 — Shortlist Verification & Payment Portal (reveals QR Entry Pass on confirm) */}
        <ShortlistPortal />

        <Suspense fallback={<div className="h-40" />}>
          {/* 4 — Digital Photobooth */}
          <PhotoBoothSection />

          {/* 5 — 36-Hour Interactive Agenda */}
          <Timeline />

          {/* 6 — Moments from Past Editions (gallery + legacy metrics) */}
          <Gallery />
          <Stats />

          {/* 7 — FAQ (restored from V1) */}
          <FAQs />

          {/* 8 — Contact Leads (restored from V1) */}
          <Contact />

          {/* 9 — Social handles + Footer (restored from V1) */}
          <SocialMedia />
          <Footer />
        </Suspense>
      </main>
    </>
  );
}
