import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Design System v2 ──────────────────────────────────────
        // Backgrounds
        void: "#0B0F14",   // Primary background
        ink: "#121820",    // Secondary background
        panel: "#1A2332",  // Surface / card
        line: "#2A3647",   // Borders / dividers
        // Text
        fg: "#EDEDED",     // Primary text
        subtle: "#8B9797", // Secondary text
        muted: "#829580",  // Muted text
        disabled: "#A5B4C6", // Disabled text
        // Brand accents
        plasma: "#186275", // Primary accent (teal)
        indigo: "#240C5C", // Secondary accent (deep indigo)
        lumen: "#4ACBEB",  // Neon cyan glow — the hero accent
        glow: "#4ACBEB",   // Explicit glow token (alias)
        // Status
        success: "#1A9E4A",
        gold: "#CD8200",   // Warning
        ember: "#AD0D03",  // Error
      },
      fontFamily: {
        sans: ['"Alegreya Sans"', "system-ui", "sans-serif"],
        display: ['"Playfair Display"', "ui-serif", "serif"],
        serif: ['"Playfair Display"', "ui-serif", "serif"],
        body: ['"Alegreya Sans"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
        baskerville: ['"Libre Baskerville"', "serif"],
        sora: ['"Sora"', "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.03em",
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(74,203,235,0.5)",
        cyan: "0 0 40px -8px rgba(74,203,235,0.55)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(74,203,235,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(74,203,235,0.05) 1px, transparent 1px)",
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
