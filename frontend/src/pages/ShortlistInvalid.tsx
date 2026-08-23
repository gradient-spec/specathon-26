import { Link } from "react-router-dom";
import { AlertCircle, House } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ShortlistInvalid() {
  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-lg rounded-2xl border border-line bg-panel/20 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-ember/30 bg-ember/[0.08]">
            <AlertCircle className="text-ember" size={28} />
          </div>
          <h1 className="mt-6 font-display text-3xl md:text-4xl">Invalid or Expired Link</h1>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            This shortlist access link is invalid or has expired. Please check the link provided in your notification.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/" className="btn-primary">
              <House size={15} />
              Return to SPECATHON
            </Link>
            <Link to="/shortlist/recover" className="btn-ghost">Recover Access</Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
