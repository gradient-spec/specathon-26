import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "specathon-admin-auth" },
      })
    : null;

export const teamSupabase =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: "specathon-team-auth" },
      })
    : null;

/* ─── Types ─────────────────────────────────────────────────────── */

export type MemberInput = {
  name: string;
  phone?: string;
  year?: string;
  roll_number?: string;
  department?: string;
  email?: string;
};

/* ─── Client-side file validation ──────────────────────────────── */

const ABSTRACT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export function validateAbstract(file: File | null): string | null {
  if (!file) return "Please upload your abstract (.pptx).";
  const mime = file.type || "";
  const name = (file.name || "").toLowerCase();
  const isPptx = mime === PPTX_MIME || name.endsWith(".pptx");
  if (!isPptx) return "Abstract must be a PowerPoint (.pptx) file.";
  if (file.size > ABSTRACT_MAX_BYTES) return "Abstract file must be under 10 MB.";
  return null;
}
