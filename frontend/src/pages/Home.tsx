import { lazy, Suspense, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Loader from "@/components/Loader";
import Cursor from "@/components/Cursor";
import Particles from "@/components/Particles";
import ShortlistPortal from "@/components/ShortlistPortal";
import SeatCountdown from "@/components/SeatCountdown";
import PhotoBoothSection from "@/components/PhotoBoothSection";
import { useLenis } from "@/hooks/useLenis";

const Stats = lazy(() => import("@/components/Stats"));
const Timeline = lazy(() => import("@/components/Timeline"));
const Gallery = lazy(() => import("@/components/Gallery"));
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

  // Scroll to a hash target (e.g. arriving via "/#contact" from another route,
  // such as the organizer link on the Team Payment pages). The target section
  // may be lazy-loaded, so retry briefly until it exists in the DOM.
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    let attempts = 0;
    let timeoutId: number;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        window.scrollTo(0, el.offsetTop - 64);
        return;
      }
      if (attempts++ < 30) timeoutId = window.setTimeout(tryScroll, 100);
    };
    tryScroll();
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <>
      <Loader />
      <Cursor />
      <Particles />
      <Navbar />
      <main className="relative">
        {/* 1 — Hero: Shortlist announcement + Sep 11 deadline countdown */}
        <Hero />

        {/* 2 & 3 — Shortlist Verification (left) + Digital Photobooth (right) as a
            deliberate two-column composition on desktop; stacks naturally below lg. */}
        <section className="relative">
          <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-y-10 lg:items-center">
            <ShortlistPortal />
            <PhotoBoothSection />
          </div>
        </section>
        <Stats />
        {/* Seat-confirmation countdown — sits directly below the Shortlist portal,
            width-aligned with it. */}
        <SeatCountdown />

        <Suspense fallback={<div className="h-40" />}>
          {/* 5 — 36-Hour Interactive Agenda */}
          <Timeline />

          {/* 6 — Legacy metrics + Moments from Past Editions */}
         
          <Gallery />

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
