import { lazy, Suspense, useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import LiveHero from "@/components/LiveHero";
import InvitationIntro from "@/components/InvitationIntro";
import Cursor from "@/components/Cursor";
import Particles from "@/components/Particles";
import Watermark from "@/components/Watermark";
import PhotoBoothSection from "@/components/PhotoBoothSection";
import { useLenis } from "@/hooks/useLenis";

const Stats = lazy(() => import("@/components/Stats"));
const Timeline = lazy(() => import("@/components/Timeline"));
const Gallery = lazy(() => import("@/components/Gallery"));
const FAQs = lazy(() => import("@/components/FAQs"));
const Contact = lazy(() => import("@/components/Contact"));
const SocialMedia = lazy(() => import("@/components/SocialMedia"));
const Footer = lazy(() => import("@/components/Footer"));

export default function Home() {
  useLenis();
  const [introActive, setIntroActive] = useState(true);
  const [heroActive, setHeroActive] = useState(false);

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
      <Watermark />
      <Navbar />
      <main className="relative">
        {/* 1 — LiveHero: welcome to SPECATHON 2026. isActive stays false while
            the invitation is fully showing, so Hero's entrance animations
            don't run (and finish) hidden behind it — they only start once
            the invitation begins its exit fade (heroActive), giving a true
            crossfade instead of a hard cut followed by a separate wait. */}
        <LiveHero isActive={heroActive} />

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
