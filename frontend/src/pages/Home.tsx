import { lazy, Suspense, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import InvitationIntro from "@/components/InvitationIntro";
import Cursor from "@/components/Cursor";
import Particles from "@/components/Particles";
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
 * SPECATHON 2026 — V3 single-page structure: the event-welcome phase.
 * InvitationIntro plays a ~3.5–4s automatic cinematic opening (no click
 * required) over the homepage's fixed overlay layer — the same role the
 * previous progress-bar Loader played — then hands off to Hero underneath.
 * Section sequence: Hero → Countdown → Stats → Timeline → Digital
 * Photobooth → Gallery → FAQ → Contact. The V2 registration/shortlist
 * search panel has been removed from the public homepage (Team Portal
 * routes are unaffected). The Digital Photobooth is unrelated to the V2
 * shortlist/payment flow and remains part of V3.
 */
export default function Home() {
  useLenis();
  const [introActive, setIntroActive] = useState(true);
  // Flips true when the invitation's hold begins (well before its exit
  // fade starts) — see InvitationIntro.tsx's file-level comment. Hero
  // mounts and starts its own entrance choreography immediately, hidden
  // behind the still-opaque invitation, so it's already visibly mid-reveal
  // by the time the invitation's crossfade reaches the viewer — no dead
  // gap after the cut.
  const [heroActive, setHeroActive] = useState(false);

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
      <InvitationIntro
        onHeroActivate={() => setHeroActive(true)}
        onComplete={() => setIntroActive(false)}
      />
      <Cursor />
      <Particles elevated={introActive} />
      <Navbar />
      <main className="relative">
        {/* 1 — Hero: welcome to SPECATHON 2026. isActive stays false while
            the invitation is fully showing, so Hero's entrance animations
            don't run (and finish) hidden behind it — they only start once
            the invitation begins its exit fade (heroActive), giving a true
            crossfade instead of a hard cut followed by a separate wait. */}
        <Hero isActive={heroActive} />

        {/* 2 — Stats */}
        <Stats />

        <Suspense fallback={<div className="h-40" />}>
          {/* 3 — Timeline: the SPECATHON 2026 journey */}
          <Timeline />

          {/* 4 — Digital Photobooth */}
          <PhotoBoothSection />

          {/* 5 — Gallery: moments from past editions */}
          <Gallery />

          {/* 6 — FAQ */}
          <FAQs />

          {/* 7 — Contact */}
          <Contact />

          {/* Site chrome — social handles + footer */}
          <SocialMedia />
          <Footer />
        </Suspense>
      </main>
    </>
  );
}
