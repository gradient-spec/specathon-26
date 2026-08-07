import { lazy, Suspense } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Loader from "@/components/Loader";
import Cursor from "@/components/Cursor";
import Particles from "@/components/Particles";
import ShortlistedTeamsSection from "@/components/ShortlistedTeamsSection";
import PhotoBoothSection from "@/components/PhotoBoothSection";
import { useLenis } from "@/hooks/useLenis";

const Gallery = lazy(() => import("@/components/Gallery"));
const Timeline = lazy(() => import("@/components/Timeline"));
const FAQs = lazy(() => import("@/components/FAQs"));
const Contact = lazy(() => import("@/components/Contact"));
const SocialMedia = lazy(() => import("@/components/SocialMedia"));
const Footer = lazy(() => import("@/components/Footer"));

export default function Home() {
  useLenis();
  return (
    <>
      <Loader />
      <Cursor />
      <Particles />
      <Navbar />
      <main className="relative">
        <Hero />
        <Suspense fallback={<div className="h-40" />}>
          <Gallery />
          <Stats />
          <Timeline />
          {/* Shortlisted Teams — embedded section with id="shortlisted" for scroll nav */}
          <ShortlistedTeamsSection embedded />
          {/* Digital Photobooth — embedded below shortlisted teams */}
          <PhotoBoothSection />
          <FAQs />
          <Contact />
          <SocialMedia />
          <Footer />
        </Suspense>
      </main>
    </>
  );
}
