#!/usr/bin/env node
/**
 * SPECATHON · Live CSV sync
 *
 * Subscribes to Supabase Realtime and rewrites registrations.csv
 * whenever a team or member changes. Keep this running in a terminal
 * while the event is live.
 *
 *   npm run sync:csv
 *
 * Requires SUPABASE_SECRET_DEFAULT (Supabase new default secret).
 * NEVER commit that key. Keep it in .env, which is gitignored.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Load .env (no dependency needed) ──────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  // Strip UTF-8 BOM if present (Notepad on Windows adds one).
  let raw = readFileSync(envPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);

  for (const line of raw.split(/\r?\n/)) {
    // Skip blanks / comments
    if (!line || /^\s*#/.test(line)) continue;
    // Accept any KEY=VALUE (letters, digits, underscores, case-insensitive)
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SECRET_DEFAULT;

if (!SUPA_URL || !SUPA_KEY) {
  console.error(
    "\n[sync-csv] Missing env. Loaded keys from .env: " +
      Object.keys(process.env)
        .filter((k) => k.startsWith("VITE_") || k.startsWith("SUPABASE_"))
        .join(", ") +
      "\n\nRequired:\n" +
      "  VITE_SUPABASE_URL=https://your-project.supabase.co\n" +
      "  SUPABASE_SECRET_DEFAULT=sb_secret_...   (New Supabase default secret)\n"
  );
  process.exit(1);
}

const OUT_DIR = path.resolve(__dirname, "..", "registrations");
const OUT_FILE = path.join(OUT_DIR, "registrations.csv");

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── CSV helpers ───────────────────────────────────────────────────
const HEADERS = [
  "registered_at",
  "team_name",
  "domain",
  "team_size",
  "leader_name",
  "email",
  "phone",
  "college",
  "members",
];

const esc = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows) =>
  [HEADERS.join(","), ...rows.map((r) => HEADERS.map((h) => esc(r[h])).join(","))].join("\r\n") + "\r\n";

// ── Fetch + write ─────────────────────────────────────────────────
let inflight = false;
let queued = false;

async function refresh(reason) {
  if (inflight) {
    queued = true;
    return;
  }
  inflight = true;
  try {
    const { data: teams, error: e1 } = await supabase
      .from("teams")
      .select("id, created_at, team_name, domain, team_size, leader_name, email, phone, college, github, linkedin")
      .order("created_at", { ascending: false });
    if (e1) throw e1;

    const ids = (teams ?? []).map((t) => t.id);
    let membersByTeam = new Map();
    if (ids.length > 0) {
      const { data: members, error: e2 } = await supabase
        .from("team_members")
        .select("team_id, name, email, role, created_at")
        .in("team_id", ids)
        .order("created_at", { ascending: true });
      if (e2) throw e2;
      for (const m of members ?? []) {
        if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
        membersByTeam.get(m.team_id).push(m);
      }
    }

    const rows = (teams ?? []).map((t) => ({
      registered_at: t.created_at,
      team_name: t.team_name,
      domain: t.domain,
      team_size: t.team_size,
      leader_name: t.leader_name,
      email: t.email,
      phone: t.phone,
      college: t.college,
      members: (membersByTeam.get(t.id) ?? [])
        .map((m) => (m.email ? `${m.name} <${m.email}>` : m.name))
        .join(" | "),
    }));

    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(OUT_FILE, toCsv(rows), "utf8");

    const stamp = new Date().toLocaleTimeString();
    console.log(`[${stamp}] wrote ${rows.length} team${rows.length === 1 ? "" : "s"} → ${path.relative(process.cwd(), OUT_FILE)}   (${reason})`);
  } catch (err) {
    console.error("[sync-csv] refresh failed:", err.message ?? err);
  } finally {
    inflight = false;
    if (queued) {
      queued = false;
      refresh("coalesced");
    }
  }
}

// ── Modes ─────────────────────────────────────────────────────────
//  npm run sync:csv           → live watcher (Realtime + 5 min safety poll)
//  npm run export:csv         → one-shot, writes then exits (zero load)
//  npm run sync:csv -- --interval=5m → poll-only, no Realtime
// ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const once = args.includes("--once");
const intervalArg = args.find((a) => a.startsWith("--interval="));
const pollMs = intervalArg ? parseDuration(intervalArg.split("=")[1]) : null;

function parseDuration(s) {
  const m = /^(\d+)(ms|s|m|h)?$/.exec(s.trim());
  if (!m) return 300_000;
  const n = Number(m[1]);
  return n * { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }[m[2] ?? "s"];
}

// Debounce so a team + members insert (2 events, ~ms apart) writes once.
let debounceTimer = null;
function scheduleRefresh(reason) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => refresh(reason), 400);
}

console.log("[sync-csv] starting · project:", new URL(SUPA_URL).host);
await refresh("initial");

if (once) {
  console.log("[sync-csv] one-shot done.");
  process.exit(0);
}

let channel = null;
if (!pollMs) {
  channel = supabase
    .channel("registrations-sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" },        () => scheduleRefresh("teams changed"))
    .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => scheduleRefresh("members changed"))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") console.log("[sync-csv] listening for changes… (Ctrl+C to stop)");
      if (status === "CHANNEL_ERROR") console.error("[sync-csv] realtime channel error");
    });

  // Light safety net in case the socket drops silently: every 5 min.
  setInterval(() => refresh("safety-poll"), 5 * 60_000);
} else {
  console.log(`[sync-csv] polling every ${pollMs / 1000}s (no realtime socket).`);
  setInterval(() => refresh("poll"), pollMs);
}

const shutdown = async () => {
  console.log("\n[sync-csv] shutting down");
  if (channel) await supabase.removeChannel(channel);
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
