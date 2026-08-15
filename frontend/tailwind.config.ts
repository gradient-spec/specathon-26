import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Design System v2 ──────────────────────────────────────
        // Backgrounds
        void: "#0B0F14",   // Primary background
        ink: {
          DEFAULT: "#121820", // Secondary background (V2)
          950: "#0B0F1A",     // Photobooth camera viewport
          900: "#0F172A",
          800: "#111827",
        },
        panel: "#1A2332",  // Surface / card
        line: "#2A3647",   // Borders / dividers
        // Text
        fg: "#EDEDED",     // Primary text
        subtle: "#8B9797", // Secondary text
        muted: "#829580",  // Muted text
        disabled: "#A5B4C6", // Disabled text
        // Brand accents
        plasma: "#186275", // Primary accent (teal) — fills, buttons, borders
        indigo: "#240C5C", // Secondary accent (deep indigo)
        // Legible teal tint of the primary brand for on-dark text links, icons,
        // highlights and glows (replaces the retired neon cyan; passes AA on #0B0F14).
        lumen: "#2F93AD",
        glow: "#2F93AD",   // Explicit glow token (alias)
        // Status
        success: "#1A9E4A",
        gold: "#CD8200",   // Warning
        ember: "#AD0D03",  // Error
        // Photobooth accent tokens (from standalone photobooth project)
        "indigo-glow": "#5B5FEF",
        "violet-glow": "#8B5CF6",
        "cyan-glow": "#00C2FF",
        paper: {
          DEFAULT: "#F2EEE4",
          dark: "#E8E2D3",
          platinum: "#D8D8D2",
        },
      },
      fontFamily: {
        sans: ['"Alegreya Sans"', "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "ui-serif", "serif"],
        serif: ['"Playfair Display"', "ui-serif", "serif"],
        playfair: ['"Playfair Display"', "ui-serif", "Georgia", "serif"],
        body: ['"Alegreya Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        baskerville: ['"Libre Baskerville"', "serif"],
        sora: ['"Sora"', "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(47,147,173,0.5)",
        cyan: "0 0 40px -8px rgba(47,147,173,0.55)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(47,147,173,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(47,147,173,0.05) 1px, transparent 1px)",
        radial: "radial-gradient(1200px 600px at 50% -10%, rgba(24,98,117,0.28), transparent 60%)",
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        drift: "drift 22s linear infinite",
        pulseGlow: "pulseGlow 3.5s ease-in-out infinite",
        scan: "scan 6s linear infinite",
      },
      keyframes: {
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-14px)" },
        },
        drift: {
          "0%": { transform: "translate3d(0,0,0)" },
          "100%": { transform: "translate3d(-80px,40px,0)" },
        },
        pulseGlow: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
