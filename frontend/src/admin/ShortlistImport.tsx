import { useRef, useState } from "react";
import { FileUp, Loader2, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";
import { importShortlisted, type ShortlistedTeamRow } from "@/services/admin";

// ── CSV parsing ────────────────────────────────────────────────────────────
// The frontend ONLY parses the CSV into plain objects so they can be sent
// to the backend. All validation and insertion logic lives in the RPC.

const REQUIRED_HEADERS = [
  "team_id",
  "registration_source",
  "team_name",
  "team_lead_name",
  "contact",
  "team_size",
  "amount",
  "payment_status",
  "payment_notes",
] as const;

class ParseError extends Error { }

function splitLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuote && next === '"') { current += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "\n" && !inQuote) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);
  return lines;
}

function parseFields(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i <= line.length; i++) {
    const ch = line[i];
    if (i === line.length) { fields.push(field.trim()); break; }
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { field += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      fields.push(field.trim());
      field = "";
    } else {
      field += ch;
    }
  }
  return fields;
}

function parseCsv(raw: string): ShortlistedTeamRow[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
  const lines = splitLines(text).filter(l => l.trim());

  if (lines.length === 0) throw new ParseError("The CSV file is empty.");
  if (lines.length < 2) throw new ParseError("The CSV file has no data rows.");

  const headers = parseFields(lines[0]);

  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  const extra = headers.filter(h => !(REQUIRED_HEADERS as readonly string[]).includes(h));
  if (missing.length > 0 || extra.length > 0) {
    const parts: string[] = [];
    if (missing.length > 0) parts.push(`Missing: ${missing.join(", ")}`);
    if (extra.length > 0) parts.push(`Unexpected: ${extra.join(", ")}`);
    throw new ParseError(
      `Invalid CSV headers. ${parts.join(". ")}.\n` +
      `Expected: ${REQUIRED_HEADERS.join(", ")}`
    );
  }

  const rows: ShortlistedTeamRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const fields = parseFields(lines[i]);
    if (fields.length !== headers.length) {
      throw new ParseError(
        `Row ${i + 1}: column count mismatch ` +
        `(expected ${headers.length}, got ${fields.length}).`
      );
    }
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = fields[idx]; });

    rows.push({
      team_id: obj.team_id,
      registration_source: obj.registration_source as "WEBSITE" | "UNSTOP",
      team_name: obj.team_name,
      team_lead_name: obj.team_lead_name,
      contact: obj.contact,
      team_size: parseInt(obj.team_size, 10),
      amount: parseInt(obj.amount, 10),
      payment_status: "PENDING",
      payment_notes: obj.payment_notes?.trim() || null,
    });
  }
  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────

type State =
  | { type: "idle" }
  | { type: "ready"; file: File; rows: ShortlistedTeamRow[] }
  | { type: "uploading" }
  | { type: "success"; imported: number }
  | { type: "error"; message: string };

export default function ShortlistImport({ onImported }: { onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ type: "idle" });

  // ── File selection ───────────────────────────────────────────────────────
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { setState({ type: "idle" }); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setState({ type: "error", message: "Please select a .csv file." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw = ev.target?.result as string;
        const rows = parseCsv(raw);
        setState({ type: "ready", file, rows });
      } catch (err) {
        setState({
          type: "error",
          message: err instanceof ParseError
            ? err.message
            : "Failed to read the file.",
        });
      }
    };
    reader.readAsText(file, "utf-8");
  };

  // ── Upload ───────────────────────────────────────────────────────────────
  const onUpload = async () => {
    if (state.type !== "ready") return;
    setState({ type: "uploading" });
    try {
      const result = await importShortlisted(state.rows);
      setState({ type: "success", imported: result.imported });
      onImported();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      // Supabase wraps RPC errors — the useful message is inside .message
      setState({ type: "error", message: raw });
    }
  };

  const reset = () => {
    setState({ type: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const busy = state.type === "uploading";

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <div className="eyebrow">V2 · Shortlisted Teams</div>
        <h2 className="font-display text-2xl md:text-3xl tracking-tightest mt-2">
          Import Shortlist
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Upload a CSV to populate the <code className="font-mono text-fg/80">shortlisted_teams</code> table.
          The entire file is validated and imported atomically — if any row is invalid
          the whole import is rejected with a detailed error.
        </p>
      </div>

      {/* Expected format */}
      <div className="rounded-xl border border-line bg-panel/40 p-4 text-xs font-mono text-muted space-y-1">
        <div className="text-[10px] uppercase tracking-[0.24em] text-muted mb-2">Expected CSV headers</div>
        <div className="text-fg/70 leading-relaxed break-all">
          {REQUIRED_HEADERS.join(", ")}
        </div>
      </div>

      {/* File picker */}
      <div className="rounded-2xl glass p-6 space-y-5">

        <label className="block">
          <span className="eyebrow mb-2 block">CSV File</span>
          <div className="relative">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              disabled={busy}
              className="
                w-full cursor-pointer rounded-xl border border-line bg-panel/40 px-4 py-3
                text-sm text-fg
                file:mr-4 file:cursor-pointer file:rounded-lg file:border-0
                file:bg-plasma/15 file:px-3 file:py-1.5 file:text-xs file:font-medium
                file:text-fg file:transition-colors hover:file:bg-plasma/25
                focus:border-lumen/60 focus:outline-none
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            />
          </div>
        </label>

        {/* Parsed file summary */}
        {state.type === "ready" && (
          <div className="flex items-center gap-3 rounded-lg border border-lumen/30 bg-lumen/[0.06] px-4 py-3 text-sm">
            <FileUp size={14} className="text-lumen shrink-0" />
            <div>
              <span className="text-fg font-medium">{state.file.name}</span>
              <span className="text-muted ml-2">—</span>
              <span className="text-lumen ml-2">{state.rows.length} team{state.rows.length === 1 ? "" : "s"} parsed</span>
            </div>
          </div>
        )}

        {/* Upload button */}
        <button
          onClick={onUpload}
          disabled={state.type !== "ready" || busy}
          className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy
            ? <><Loader2 size={15} className="animate-spin" /> Importing…</>
            : <><UploadCloud size={15} /> Upload &amp; Import</>
          }
        </button>
      </div>

      {/* Success message */}
      {state.type === "success" && (
        <div className="flex items-start gap-3 rounded-xl border border-success/40 bg-success/[0.06] p-4">
          <CheckCircle2 size={16} className="text-success mt-0.5 shrink-0" />
          <div>
            <div className="font-medium text-sm text-fg">Import Successful</div>
            <div className="text-sm text-muted mt-1">
              {state.imported} team{state.imported === 1 ? "" : "s"} imported successfully.
            </div>
            <button
              onClick={reset}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-line text-muted hover:text-fg hover:border-lumen/40 transition-colors"
            >
              Import another file
            </button>
          </div>
        </div>
      )}

      {/* Error message — exact backend message, never replaced */}
      {state.type === "error" && (
        <div className="flex items-start gap-3 rounded-xl border border-ember/40 bg-ember/[0.08] p-4">
          <AlertCircle size={16} className="text-ember mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-ember">Import Failed</div>
            <pre className="mt-2 text-xs text-ember/80 whitespace-pre-wrap break-words leading-relaxed font-mono">
              {state.message}
            </pre>
            <button
              onClick={reset}
              className="mt-3 text-xs px-3 py-1.5 rounded-lg border border-ember/30 text-ember/80 hover:text-ember hover:border-ember/50 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
