import type { ReactNode } from "react";
import Navbar from "@/components/Navbar";
import Particles from "@/components/Particles";

/* Shared visual shell for every /team/* page — reuses the exact V2 home-page
   background (the Particles starfield) and the standard site Navbar
   (SPECATHON wordmark + SPEC logo), so all Team Portal pages stay visually
   consistent without duplicating this markup per page. */
export default function TeamPortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-void text-fg flex flex-col noise overflow-hidden">
      <Particles />
      <Navbar hideShortlist />
      <main className="relative z-10 flex-1 flex flex-col">{children}</main>
    </div>
  );
}
