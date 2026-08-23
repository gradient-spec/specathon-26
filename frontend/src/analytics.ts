/**
 * Google Analytics 4 initialisation — SPECATHON 2026
 *
 * Moved out of index.html to avoid requiring 'unsafe-inline' in the CSP.
 * The gtag.js script tag (with `async src`) stays in index.html because
 * it is a plain external script with no inline content; the CSP allows it
 * via `script-src https://www.googletagmanager.com`.
 *
 * This module is imported once from main.tsx and runs immediately.
 */

const GA_ID = "G-6NTN0DVME7";

// Initialise the global dataLayer that gtag.js expects.
// Using `window as any` avoids importing @types/gtag.js as a dev dep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
w.dataLayer = w.dataLayer || [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function gtag(..._args: any[]): void {
  // eslint-disable-next-line prefer-rest-params
  w.dataLayer.push(arguments);
}

gtag("js", new Date());
gtag("config", GA_ID);

// Re-export so callers can push custom events if needed in future.
export { gtag };
