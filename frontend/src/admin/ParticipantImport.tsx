import { useRef, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, UploadCloud } from "lucide-react";
import { importParticipants, type ParticipantRow } from "@/services/admin";

// ── CSV parsing ────────────────────────────────────────────────────────────
// The frontend ONLY parses the CSV into plain objects so they can be sent
// to the backend. All validation and insertion logic lives in the RPC.

const REQUIRED_HEADERS = [
  "team_id",
  "member_id",
  "member_name",
  "email",
  "phone",
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

function parseCsv(raw: string): ParticipantRow[] {
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

  const rows: ParticipantRow[] = [];
  const seenIdentity = new Set<string>();

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

    const team_id = obj.team_id?.trim();
    const member_id = obj.member_id?.trim();
    const member_name = obj.member_name?.trim();

    if (!team_id) throw new ParseError(`Row ${i + 1}: team_id is required.`);
    if (!member_id) throw new ParseError(`Row ${i + 1}: member_id is required.`);
    if (!member_name) throw new ParseError(`Row ${i + 1}: member_name is required.`);

    const identity = `${team_id}-${member_id}`;
    if (seenIdentity.has(identity)) {
      throw new ParseError(`Row ${i + 1}: Duplicate participant identity found in CSV (${identity}).`);
    }
    seenIdentity.add(identity);

    rows.push({
      team_id,
      member_id,
      member_name,
      email: obj.email?.trim() || null,
      phone: obj.phone?.trim() || null,
    });
  }
  return rows;
}

// ── Component ──────────────────────────────────────────────────────────────

type State =
  | { type: "idle" }
  | { type: "ready"; file: File; rows: ParticipantRow[] }
  | { type: "uploading" }
  | { type: "success"; imported: number }
  | { type: "error"; message: string };

export default function ParticipantImport({ onImported }: { onImported: () => void }) {
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
      const result = await importParticipants(state.rows);
      setState({ type: "success", imported: result.imported });
      onImported();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
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
        <div className="eyebrow">V2 · Participants</div>
        <h2 className="font-display text-2xl md:text-3xl tracking-tightest mt-2">
          Import Participants
        </h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Upload a CSV to populate the <code className="font-mono text-fg/80">v2_participants</code> table.
          The entire file is validated and imported atomically — if any row is invalid
          the whole import is rejected with a detailed error.
        </p>
      </div>

      {/* Expected format */}
      <div className="rounded-xl border border-line bg-panel/40 p-4 text-xs font-mono text-muted space-y-1">
        <div className="font-bold text-fg mb-2 font-sans tracking-wide">Expected CSV Format (exact headers):</div>
        <div>team_id,member_id,member_name,email,phone</div>
        <div className="opacity-60 mt-2">Example:</div>
        <div className="opacity-60">SPEC2026-0057,m1,John Doe,john@example.com,9876543210</div>
        <div className="opacity-60">SPEC2026-0057,m2,Jane Doe,,9876543211</div>
      </div>

      {/* Upload Zone */}
      <div className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all ${state.type === "ready"
          ? "border-plasma/50 bg-plasma/5"
          : state.type === "success"
            ? "border-lumen/50 bg-lumen/5"
            : state.type === "error"
              ? "border-ember/50 bg-ember/5"
              : "border-line bg-panel/20 hover:bg-panel/40 hover:border-line/80"
        }`}>
        
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={onFileChange}
          disabled={busy}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
        />

        <div className="p-8 md:p-12 text-center pointer-events-none flex flex-col items-center justify-center min-h-[240px]">
          {state.type === "idle" && (
            <>
              <div className="h-12 w-12 rounded-full bg-void border border-line flex items-center justify-center mb-4 shadow-xl">
                <UploadCloud className="text-muted" size={20} />
              </div>
              <p className="text-sm font-medium text-fg">Click or drag a CSV file to import</p>
              <p className="text-xs text-muted mt-1">UTF-8 formatted .csv only</p>
            </>
          )}

          {state.type === "ready" && (
            <>
              <div className="h-12 w-12 rounded-full bg-plasma/10 border border-plasma/20 flex items-center justify-center mb-4 text-plasma">
                <UploadCloud size={20} />
              </div>
              <p className="text-sm font-medium text-plasma">{state.file.name}</p>
              <p className="text-xs text-plasma/70 mt-1 font-mono">{state.rows.length} rows parsed</p>
              <p className="text-xs mt-4 text-muted max-w-xs leading-relaxed">
                Review the data and click the button below to execute the database transaction.
              </p>
            </>
          )}

          {state.type === "uploading" && (
            <>
              <Loader2 className="animate-spin text-plasma mb-4" size={24} />
              <p className="text-sm font-medium text-fg animate-pulse">Running atomic import...</p>
            </>
          )}

          {state.type === "success" && (
            <>
              <div className="h-12 w-12 rounded-full bg-lumen/10 border border-lumen/20 flex items-center justify-center mb-4 text-lumen">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-medium text-lumen">Import Successful</p>
              <p className="text-xs text-lumen/70 mt-1 font-mono">{state.imported} rows written to Supabase</p>
            </>
          )}

          {state.type === "error" && (
            <>
              <div className="h-12 w-12 rounded-full bg-ember/10 border border-ember/20 flex items-center justify-center mb-4 text-ember shrink-0">
                <AlertCircle size={24} />
              </div>
              <p className="text-sm font-medium text-ember">Import Failed</p>
              <p className="text-xs text-ember/80 mt-2 font-mono bg-void/50 p-2 rounded max-w-md break-words border border-ember/20 text-left">
                {state.message}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      {state.type !== "idle" && state.type !== "uploading" && (
        <div className="flex items-center gap-3 pt-2">
          {state.type === "ready" && (
            <button
              onClick={onUpload}
              className="flex-1 bg-plasma text-void font-bold tracking-wide uppercase text-xs px-6 py-3 rounded-lg hover:bg-white transition-colors"
            >
              Execute Import
            </button>
          )}
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg border border-line text-xs font-medium text-muted hover:text-fg hover:border-line/80 transition-colors"
          >
            {state.type === "success" ? "Import Another File" : "Reset"}
          </button>
        </div>
      )}
    </div>
  );
}
