import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, ShieldAlert } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getMockRecoveryUrl, mockDevLinks } from "@/services/mockShortlist";

export default function ShortlistRecovery() {
  const [email, setEmail] = useState("alpha@example.com");
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const link = getMockRecoveryUrl(email);
    if (link) {
      setResult(link);
      return;
    }
    setResult("No matching shortlist access found for this email in development mode.");
  };

  return (
    <div className="min-h-screen bg-void text-fg flex flex-col">
      <Navbar />
      <main className="flex-1 mx-auto w-full max-w-xl px-6 py-20">
        <div className="rounded-2xl border border-line bg-panel/20 p-6 md:p-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-lumen/25 bg-lumen/[0.06] px-4 py-1.5 text-[11px] font-mono uppercase tracking-[0.28em] text-lumen mb-5">
              <ShieldAlert size={11} />
              Access Recovery
            </div>
            <h1 className="font-display text-3xl md:text-4xl">Recover Shortlist Access</h1>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block text-sm text-muted">
              Enter your registered email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="field mt-2"
                placeholder="alpha@example.com"
              />
            </label>

            <button type="submit" className="btn-primary w-full justify-center">
              <Mail size={15} />
              Send Access Link
            </button>
          </form>

          {result && (
            <div className="mt-8 rounded-xl border border-lumen/20 bg-lumen/[0.04] p-4 text-sm">
              <p className="font-mono uppercase tracking-[0.2em] text-muted">Development Mode</p>
              {result.startsWith("/") ? (
                <>
                  <p className="mt-3 text-muted">Access link generated:</p>
                  <div className="mt-2 rounded-lg border border-line bg-panel/40 px-3 py-2 font-mono text-lumen break-all">{result}</div>
                  <Link to={result} className="mt-4 inline-flex items-center gap-2 text-sm text-fg hover:text-lumen">
                    Open Access Link
                    <ArrowRight size={14} />
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-muted">{result}</p>
              )}
            </div>
          )}

          <div className="mt-8 border-t border-line pt-6">
            <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted">Demo Team Links</p>
            <div className="mt-4 space-y-2">
              {mockDevLinks.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel/20 px-3 py-2 text-sm">
                  <span>{item.label}</span>
                  <Link to={`/shortlist/${item.token}`} className="btn-ghost px-3 py-2 text-xs">Open</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
