import Navbar from "@/components/Navbar";
import PhotoBooth from "@/components/PhotoBooth";
import Footer from "@/components/Footer";

export default function PhotoBoothPage() {
  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 md:px-10 pt-28 pb-20 flex flex-col items-center gap-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-4">
            Digital Photobooth
          </div>
          <h1 className="font-display font-bold text-3xl md:text-4xl tracking-tightest">
            Capture Your{" "}
            <span className="font-serif italic text-lumen">Hackathon Moment</span>
          </h1>
          <p className="mt-3 text-muted text-sm max-w-sm mx-auto">
            Strike a pose. Capture the innovation. Share the experience.
          </p>
        </div>
        <PhotoBooth />
      </main>
      <Footer />
    </div>
  );
}
