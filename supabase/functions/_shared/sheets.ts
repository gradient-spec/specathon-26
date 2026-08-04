/**
 * SPECATHON 2026 · V2 — Google Sheets sync utility
 *
 * Exports one function: upsertSheetRows()
 *
 * Behaviour
 * ─────────
 * • Reads the Automation Sheet using the Sheets API v4.
 * • Builds an index of existing rows keyed by team_id (column A).
 * • For each row supplied:
 *     - If the team_id already exists → UPDATE that row in place.
 *     - If it does not exist        → APPEND a new row.
 * • Uses batchUpdate for all mutations in a single API round-trip.
 * • Never deletes rows.
 *
 * The caller is responsible for mapping database records to SheetRow objects.
 * This module is completely ignorant of Supabase schema details.
 *
 * Sheet column layout (1-indexed, row 1 = header)
 * ────────────────────────────────────────────────
 *  A  team_id
 *  B  registration_source
 *  C  team_name
 *  D  team_lead_name
 *  E  email
 *  F  contact
 *  G  team_size
 *  H  amount
 *  I  payment_status
 *  J  paid_at
 *  K  created_at
 *
 * Required secrets (Supabase Edge Function env)
 * ─────────────────────────────────────────────
 *  GOOGLE_SERVICE_ACCOUNT_EMAIL   — service account email
 *  GOOGLE_SERVICE_ACCOUNT_KEY     — PEM private key (RSA, newlines as \n)
 *  GOOGLE_SHEET_ID                — the spreadsheet ID from the URL
 *  GOOGLE_SHEET_TAB               — tab/sheet name (default: "Automation")
 */

// ── Column definitions ────────────────────────────────────────────────────────

export const SHEET_HEADERS = [
  "team_id",
  "registration_source",
  "team_name",
  "team_lead_name",
  "email",
  "contact",
  "team_size",
  "amount",
  "payment_status",
  "paid_at",
  "created_at",
] as const;

export type SheetRow = {
  team_id:             string;
  registration_source: string;
  team_name:           string;
  team_lead_name:      string;
  email:               string;   // empty string if unavailable
  contact:             string;
  team_size:           number;
  amount:              number;
  payment_status:      string;
  paid_at:             string;   // ISO string or empty
  created_at:          string;   // ISO string
};

// ── JWT helpers for Google service account auth ───────────────────────────────

/**
 * Signs a Google service-account JWT and exchanges it for a short-lived
 * OAuth2 access token with the spreadsheets.readwrite scope.
 *
 * Deno has native SubtleCrypto — no external crypto libraries needed.
 */
async function getAccessToken(): Promise<string> {
  const email  = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const rawKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");

  if (!email)  throw new Error("[sheets] Missing secret: GOOGLE_SERVICE_ACCOUNT_EMAIL");
  if (!rawKey) throw new Error("[sheets] Missing secret: GOOGLE_SERVICE_ACCOUNT_KEY");

  // ── Decode PEM private key ──────────────────────────────────────────────
  const pem = rawKey
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  const derBuf = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    derBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // ── Build JWT ──────────────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  const header  = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss:   email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${signingInput}.${sigB64}`;

  // ── Exchange for access token ──────────────────────────────────────────
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[sheets] Token exchange failed: ${err}`);
  }

  const tokenData = await res.json() as { access_token: string };
  return tokenData.access_token;
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function rowToValues(row: SheetRow): string[] {
  return [
    row.team_id,
    row.registration_source,
    row.team_name,
    row.team_lead_name,
    row.email,
    row.contact,
    String(row.team_size),
    String(row.amount),
    row.payment_status,
    row.paid_at,
    row.created_at,
  ];
}

/** Convert a 0-based column index to A1 letter notation (0→A, 1→B, …, 25→Z). */
function colLetter(idx: number): string {
  let letter = "";
  let n = idx;
  do {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letter;
}

const LAST_COL = colLetter(SHEET_HEADERS.length - 1); // "K"

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Upserts the supplied rows into the Automation Sheet.
 *
 * • Fetches the current sheet contents once.
 * • Rows whose team_id matches an existing row are updated in place.
 * • Rows with a new team_id are appended.
 * • A single batchUpdate call handles all updates; appends use
 *   values.append for simplicity.
 *
 * Throws on any unrecoverable error. The caller must catch and handle.
 */
export async function upsertSheetRows(rows: SheetRow[]): Promise<void> {
  if (rows.length === 0) return;

  const spreadsheetId = Deno.env.get("GOOGLE_SHEET_ID");
  const tabName       = Deno.env.get("GOOGLE_SHEET_TAB") ?? "Automation";

  if (!spreadsheetId) throw new Error("[sheets] Missing secret: GOOGLE_SHEET_ID");

  const token = await getAccessToken();
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── 1. Read current sheet contents ───────────────────────────────────────
  const range    = `${tabName}!A1:${LAST_COL}`;
  const readRes  = await fetch(`${baseUrl}/values/${encodeURIComponent(range)}`, { headers });

  if (!readRes.ok) {
    const err = await readRes.text();
    throw new Error(`[sheets] Failed to read sheet: ${err}`);
  }

  const readData = await readRes.json() as { values?: string[][] };
  const existing: string[][] = readData.values ?? [];

  // ── 2. Ensure header row exists ───────────────────────────────────────────
  if (existing.length === 0) {
    // Sheet is completely empty — write headers first
    await fetch(
      `${baseUrl}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
      {
        method:  "PUT",
        headers,
        body:    JSON.stringify({ values: [SHEET_HEADERS as unknown as string[]] }),
      },
    );
    existing.push(SHEET_HEADERS as unknown as string[]);
  }

  // ── 3. Build team_id → row index map (1-based, row 1 = header) ───────────
  // existing[0] = header row, existing[1] = first data row (sheet row 2)
  const idToSheetRow = new Map<string, number>();
  for (let i = 1; i < existing.length; i++) {
    const teamId = existing[i][0];
    if (teamId) idToSheetRow.set(teamId.trim(), i + 1); // i+1 = 1-based sheet row
  }

  // ── 4. Partition into updates vs appends ─────────────────────────────────
  const updateRequests: { range: string; values: string[][] }[] = [];
  const appendValues: string[][] = [];

  for (const row of rows) {
    const values = rowToValues(row);
    const existingSheetRow = idToSheetRow.get(row.team_id.trim());

    if (existingSheetRow !== undefined) {
      // Update the existing row in place
      updateRequests.push({
        range:  `${tabName}!A${existingSheetRow}:${LAST_COL}${existingSheetRow}`,
        values: [values],
      });
    } else {
      // New team — will be appended
      appendValues.push(values);
    }
  }

  // ── 5. Execute updates via batchUpdate ────────────────────────────────────
  if (updateRequests.length > 0) {
    const batchRes = await fetch(
      `${baseUrl}/values:batchUpdate`,
      {
        method:  "POST",
        headers,
        body:    JSON.stringify({
          valueInputOption: "RAW",
          data:             updateRequests,
        }),
      },
    );
    if (!batchRes.ok) {
      const err = await batchRes.text();
      throw new Error(`[sheets] batchUpdate failed: ${err}`);
    }
  }

  // ── 6. Append new rows ────────────────────────────────────────────────────
  if (appendValues.length > 0) {
    const appendRange  = `${tabName}!A:${LAST_COL}`;
    const appendRes = await fetch(
      `${baseUrl}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method:  "POST",
        headers,
        body:    JSON.stringify({ values: appendValues }),
      },
    );
    if (!appendRes.ok) {
      const err = await appendRes.text();
      throw new Error(`[sheets] append failed: ${err}`);
    }
  }
}
