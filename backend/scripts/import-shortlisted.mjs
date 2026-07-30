#!/usr/bin/env node
/**
 * SPECATHON 2026 · V2 — Shortlisted Teams CSV Importer
 *
 * Reads a CSV file, validates every row against the shortlisted_teams
 * schema, then imports all rows atomically via the
 * import_shortlisted_teams() RPC.
 *
 * If ANY row fails validation the entire import is rejected before
 * touching the database. If the RPC throws, Postgres rolls back the
 * entire batch automatically.
 *
 * Usage:
 *   node scripts/import-shortlisted.mjs <path-to-csv>
 *   node scripts/import-shortlisted.mjs shortlisted.csv
 *
 * Required env (add to backend/.env):
 *   VITE_SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
 *
 * Expected CSV headers (exact, case-sensitive):
 *   team_id, registration_source, team_name, team_lead_name,
 *   contact, team_size, amount, payment_status, payment_notes
 *
 * Rules enforced:
 *   - team_id         required, must be unique within the file
 *   - registration_source  must be WEBSITE or UNSTOP
 *   - team_name       required
 *   - team_lead_name  required
 *   - contact         required
 *   - team_size       integer, 2–4
 *   - amount          2 members→800, 3→1200, 4→1600
 *   - payment_status  must be PENDING
 *   - payment_notes   optional
 */

import { createClient }    from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import path                from "node:path";
import { fileURLToPath }   from "node:url";

// ── Load .env (mirrors sync-csv.mjs — no extra dependency) ────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath   = path.resolve(__dirname, "..", ".env");

if (existsSync(envPath)) {
  let raw = readFileSync(envPath, "utf8");
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM
  for (const line of raw.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Env validation ────────────────────────────────────────────────────────
const SUPA_URL = process.env.VITE_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL || !SUPA_KEY) {
  fatal(
    "Missing environment variables.\n" +
    "Required in backend/.env:\n" +
    "  VITE_SUPABASE_URL=https://your-project.supabase.co\n" +
    "  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi..."
  );
}

// ── CLI arg ───────────────────────────────────────────────────────────────
const csvPath = process.argv[2];
if (!csvPath) {
  fatal("Usage: node scripts/import-shortlisted.mjs <path-to-csv>");
}
const resolvedPath = path.resolve(process.cwd(), csvPath);
if (!existsSync(resolvedPath)) {
  fatal(`File not found: ${resolvedPath}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 1 — Parse CSV
// ═══════════════════════════════════════════════════════════════════════════

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
];

/**
 * Minimal RFC-4180-compliant CSV parser.
 * Handles quoted fields, escaped double-quotes, CRLF and LF line endings.
 * Returns { headers: string[], rows: Record<string, string>[] }
 */
function parseCsv(raw) {
  // Normalise line endings, strip trailing newline
  const text  = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
  const lines = splitCsvLines(text);

  if (lines.length === 0) {
    throw new ImportError("CSV file is empty.");
  }

  const headers = parseFields(lines[0]);

  // ── Header validation ────────────────────────────────────────────────────
  const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));
  const extraHeaders   = headers.filter(h => !REQUIRED_HEADERS.includes(h));

  if (missingHeaders.length > 0 || extraHeaders.length > 0) {
    const parts = [];
    if (missingHeaders.length > 0)
      parts.push(`Missing headers: ${missingHeaders.join(", ")}`);
    if (extraHeaders.length > 0)
      parts.push(`Unexpected headers: ${extraHeaders.join(", ")}`);
    parts.push(`Expected exactly: ${REQUIRED_HEADERS.join(", ")}`);
    throw new ImportError("Invalid CSV headers. " + parts.join(". ") + ".");
  }

  // ── Parse data rows ──────────────────────────────────────────────────────
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue; // skip blank lines
    const fields = parseFields(lines[i]);
    if (fields.length !== headers.length) {
      throw new ImportError(
        `Row ${i}: column count mismatch ` +
        `(expected ${headers.length}, got ${fields.length}).`
      );
    }
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = fields[idx]; });
    rows.push(obj);
  }

  return { headers, rows };
}

/** Split CSV text into logical lines (respects quoted newlines). */
function splitCsvLines(text) {
  const lines   = [];
  let   current = "";
  let   inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch   = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuote && next === '"') { current += '"'; i++; } // escaped quote
      else inQuote = !inQuote;
    } else if (ch === "\n" && !inQuote) {
      lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Parse a single CSV line into an array of field values. */
function parseFields(line) {
  const fields = [];
  let   field  = "";
  let   inQ    = false;

  for (let i = 0; i <= line.length; i++) {
    const ch   = line[i];
    const next = line[i + 1];

    if (i === line.length) {
      fields.push(field.trim());
      break;
    }
    if (ch === '"') {
      if (inQ && next === '"') { field += '"'; i++; }
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

// ═══════════════════════════════════════════════════════════════════════════
// STEP 2 — Validate rows
// ═══════════════════════════════════════════════════════════════════════════

const AMOUNT_BY_SIZE = { 2: 800, 3: 1200, 4: 1600 };

/**
 * Validates all parsed rows.
 * Collects ALL errors before returning so the admin sees everything at once.
 * Throws ImportError if any row is invalid.
 */
function validateRows(rows) {
  const errors     = [];
  const seenIds    = new Set();

  rows.forEach((row, idx) => {
    const n = idx + 2; // +2: row 1 is headers, display is 1-indexed

    // team_id
    const teamId = row.team_id?.trim();
    if (!teamId) {
      errors.push(`Row ${n}: team_id is required.`);
    } else if (seenIds.has(teamId.toLowerCase())) {
      errors.push(`Row ${n}: duplicate team_id "${teamId}" within this file.`);
    } else {
      seenIds.add(teamId.toLowerCase());
    }

    // registration_source
    if (!["WEBSITE", "UNSTOP"].includes(row.registration_source)) {
      errors.push(
        `Row ${n}: registration_source must be WEBSITE or UNSTOP ` +
        `(got "${row.registration_source}").`
      );
    }

    // team_name
    if (!row.team_name?.trim()) {
      errors.push(`Row ${n}: team_name is required.`);
    }

    // team_lead_name
    if (!row.team_lead_name?.trim()) {
      errors.push(`Row ${n}: team_lead_name is required.`);
    }

    // contact
    if (!row.contact?.trim()) {
      errors.push(`Row ${n}: contact is required.`);
    }

    // team_size
    const sizeRaw  = row.team_size?.trim();
    const teamSize = parseInt(sizeRaw, 10);
    if (isNaN(teamSize) || String(teamSize) !== sizeRaw) {
      errors.push(`Row ${n}: team_size must be an integer (got "${sizeRaw}").`);
    } else if (teamSize < 2 || teamSize > 4) {
      errors.push(`Row ${n}: team_size must be between 2 and 4 (got ${teamSize}).`);
    } else {
      // amount (only validate if team_size is valid)
      const amountRaw = row.amount?.trim();
      const amount    = parseInt(amountRaw, 10);
      const expected  = AMOUNT_BY_SIZE[teamSize];
      if (isNaN(amount) || String(amount) !== amountRaw) {
        errors.push(`Row ${n}: amount must be an integer (got "${amountRaw}").`);
      } else if (amount !== expected) {
        errors.push(
          `Row ${n}: amount for team_size ${teamSize} must be ${expected} ` +
          `(got ${amount}).`
        );
      }
    }

    // payment_status
    if (row.payment_status !== "PENDING") {
      errors.push(
        `Row ${n}: payment_status must be PENDING on import ` +
        `(got "${row.payment_status}").`
      );
    }

    // payment_notes — optional, no validation needed
  });

  if (errors.length > 0) {
    throw new ImportError(
      `Validation failed with ${errors.length} error(s):\n` +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STEP 3 — Import via RPC
// ═══════════════════════════════════════════════════════════════════════════

async function importRows(rows) {
  const supabase = createClient(SUPA_URL, SUPA_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Normalise rows into the shape the RPC expects
  const payload = rows.map(row => ({
    team_id:             row.team_id.trim(),
    registration_source: row.registration_source,
    team_name:           row.team_name.trim(),
    team_lead_name:      row.team_lead_name.trim(),
    contact:             row.contact.trim(),
    team_size:           parseInt(row.team_size, 10),
    amount:              parseInt(row.amount, 10),
    payment_status:      "PENDING",
    payment_notes:       row.payment_notes?.trim() || null,
  }));

  const { data, error } = await supabase.rpc(
    "import_shortlisted_teams",
    { rows: payload }
  );

  if (error) {
    throw new ImportError(
      `Database import failed:\n  ${error.message ?? JSON.stringify(error)}`
    );
  }

  return data; // { imported: N, status: "ok" }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

class ImportError extends Error {}

function fatal(msg) {
  console.error(`\n[import-shortlisted] ERROR: ${msg}\n`);
  process.exit(1);
}

try {
  console.log(`\n[import-shortlisted] Reading: ${resolvedPath}`);

  const raw          = readFileSync(resolvedPath, "utf8");
  const { rows }     = parseCsv(raw);

  console.log(`[import-shortlisted] Parsed ${rows.length} row(s). Validating...`);

  validateRows(rows);

  console.log(`[import-shortlisted] Validation passed. Importing to Supabase...`);

  const result = await importRows(rows);

  console.log(
    `\n[import-shortlisted] ✓ Import complete. ` +
    `${result.imported} team(s) inserted into shortlisted_teams.\n`
  );

} catch (err) {
  if (err instanceof ImportError) {
    fatal(err.message);
  }
  // Unexpected error
  console.error("\n[import-shortlisted] Unexpected error:", err);
  process.exit(1);
}
