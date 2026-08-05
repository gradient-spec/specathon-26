import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { FullTeam } from "../services/admin";

const TODAY = () => new Date().toISOString().slice(0, 10);
const STPETERS = "St. Peter's Engineering College";

function saveBlob(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ─── Filters ────────────────────────────────────────────────────
 * Filtering happens here as the single source of truth, so no
 * caller can accidentally export the wrong scope. */

const isStPeters = (t: FullTeam) => t.is_internal || t.college === STPETERS;

/* ─── Row shaping — one row per PARTICIPANT (leader + members)
 * so every human in the team appears on its own line. */

type ParticipantRow = {
  "Registration ID": string;
  "Team Name": string;
  "Team Size": number;
  Domain: string;
  "Project Title": string;
  Role: "Leader" | "Member";
  Name: string;
  Year: string;
  "Roll Number": string;
  Department: string;
  Phone: string;
  Email: string;
  College: string;
  "College City": string;
  "College State": string;
  "Abstract URL": string;
  "Registered On": string;
};

function teamToRows(t: FullTeam): ParticipantRow[] {
  const registeredOn = new Date(t.created_at).toLocaleString();
  const college = t.college || (t.is_internal ? STPETERS : "");
  const baseTeam = {
    "Registration ID": t.reg_code ?? t.id,
    "Team Name": t.team_name,
    "Team Size": t.team_size,
    Domain: t.domain,
    "Project Title": t.project_title ?? "",
    College: college,
    "College City": t.college_city ?? "",
    "College State": t.college_state ?? "",
    "Abstract URL": t.abstract_url ?? "",
    "Registered On": registeredOn,
  };
  const leader: ParticipantRow = {
    ...baseTeam,
    Role: "Leader",
    Name: t.leader_name,
    Year: t.leader_year ?? "",
    "Roll Number": t.leader_roll ?? "",
    Department: t.leader_department ?? "",
    Phone: t.phone,
    Email: t.email ?? "",
  };
  const memberRows: ParticipantRow[] = t.members.map((m) => ({
    ...baseTeam,
    Role: "Member",
    Name: m.name,
    Year: m.year ?? "",
    "Roll Number": m.roll_number ?? "",
    Department: m.department ?? "",
    Phone: m.phone ?? "",
    Email: m.email ?? "",
    "Registered On": "",
  }));
  return [leader, ...memberRows];
}

/** Column set trimmed to columns that make sense for a scope. */
function stPetersRows(teams: FullTeam[]): Omit<ParticipantRow, "College" | "College City" | "College State">[] {
  return teams.flatMap((t) =>
    teamToRows(t).map(({ College: _c, "College City": _cc, "College State": _s, ...rest }) => rest)
  );
}

function otherRows(teams: FullTeam[]): ParticipantRow[] {
  return teams.flatMap(teamToRows);
}

function summaryRows(teams: FullTeam[]) {
  const internal = teams.filter(isStPeters);
  const external = teams.filter((t) => !isStPeters(t));
  const participants = teams.reduce((n, t) => n + 1 + t.members.length, 0);
  const domainCounts = new Map<string, number>();
  for (const t of teams) domainCounts.set(t.domain, (domainCounts.get(t.domain) ?? 0) + 1);
  const topDomain = [...domainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const colleges = new Set(teams.map((t) => t.college).filter(Boolean));

  return [
    { Metric: "Total Registered Teams", Value: teams.length },
    { Metric: "Total Participants", Value: participants },
    { Metric: "St. Peter's Teams", Value: internal.length },
    { Metric: "St. Peter's Participants", Value: internal.reduce((n, t) => n + 1 + t.members.length, 0) },
    { Metric: "Other College Teams", Value: external.length },
    { Metric: "Other College Participants", Value: external.reduce((n, t) => n + 1 + t.members.length, 0) },
    { Metric: "Total Colleges Represented", Value: colleges.size },
    { Metric: "Most Popular Domain", Value: topDomain },
    { Metric: "Generated", Value: new Date().toLocaleString() },
  ];
}

/* ─── XLSX helpers ───────────────────────────────────────────── */

function autoWidths<T extends Record<string, unknown>>(rows: T[], headers?: string[]): { wch: number }[] {
  if (rows.length === 0 && !headers) return [];
  const keys = headers ?? Object.keys(rows[0]);
  return keys.map((k) => ({
    wch: Math.min(
      50,
      Math.max(k.length, ...rows.map((r) => String(r[k as keyof T] ?? "").length)) + 2
    ),
  }));
}

/** Convert an array of objects to a sheet with:
 *  - bold header row
 *  - frozen header
 *  - auto-fit columns
 *  - alternating band via header style (banded look isn't in xlsx-community; we settle for header emphasis)
 */
function buildSheet<T extends Record<string, unknown>>(rows: T[], title: string): XLSX.WorkSheet {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Freeze header row
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as XLSX.WorkSheet["!freeze"];
  ws["!views"] = [{ state: "frozen", ySplit: 1 }] as unknown as XLSX.WorkSheet["!views"];

  // Auto widths
  ws["!cols"] = autoWidths(rows, headers);

  // Bold the header row (community xlsx supports cell.s; readers ignore if unstyled).
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "186275" } },
      alignment: { horizontal: "left", vertical: "center" },
    };
  }

  // Row height on header
  ws["!rows"] = [{ hpt: 22 }];

  // Sheet title on the tab (Excel truncates to 31 chars)
  ws["!margins"] = { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 };

  // Tab name goes at book_append_sheet time; we return the ws.
  void title;
  return ws;
}

/* ─── XLSX exports ───────────────────────────────────────────── */

function baseWb(): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: "SPECATHON 2026 Registrations",
    Subject: "Team registration export",
    Author: "SPECATHON Admin",
    CreatedDate: new Date(),
  };
  return wb;
}

export function exportStPetersXlsx(teams: FullTeam[]) {
  const scoped = teams.filter(isStPeters);
  const rows = stPetersRows(scoped);
  const wb = baseWb();

  // Sheet 1 (default) — full participant detail
  const detail = buildSheet(rows, "Participants");
  XLSX.utils.book_append_sheet(wb, detail, "Participants");

  // Sheet 2 — team-level roll-up
  const teamRoll = scoped.map((t) => ({
    "Registration ID": t.reg_code ?? t.id,
    "Team Name": t.team_name,
    "Team Size": t.team_size,
    Domain: t.domain,
    "Project Title": t.project_title ?? "",
    "Leader Name": t.leader_name,
    "Leader Email": t.email ?? "",
    "Leader Year": t.leader_year ?? "",
    "Leader Roll": t.leader_roll ?? "",
    "Leader Department": t.leader_department ?? "",
    "Leader Phone": t.phone,
    "Members Count": t.members.length,
    "Abstract URL": t.abstract_url ?? "",
    "Registered On": new Date(t.created_at).toLocaleString(),
  }));
  XLSX.utils.book_append_sheet(wb, buildSheet(teamRoll, "Teams"), "Teams");

  // Sheet 3 — summary
  const sum = XLSX.utils.json_to_sheet(summaryRows(scoped));
  sum["!cols"] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, sum, "Summary");

  XLSX.writeFile(wb, `SPECATHON2026_StPeters_${TODAY()}.xlsx`);
}

export function exportOthersXlsx(teams: FullTeam[]) {
  const scoped = teams.filter((t) => !isStPeters(t));
  const rows = otherRows(scoped);
  const wb = baseWb();

  const detail = buildSheet(rows, "Participants");
  XLSX.utils.book_append_sheet(wb, detail, "Participants");

  const teamRoll = scoped.map((t) => ({
    "Registration ID": t.reg_code ?? t.id,
    "Team Name": t.team_name,
    "Team Size": t.team_size,
    Domain: t.domain,
    "Project Title": t.project_title ?? "",
    College: t.college,
    "College City": t.college_city ?? "",
    "College State": t.college_state ?? "",
    "Leader Name": t.leader_name,
    "Leader Email": t.email ?? "",
    "Leader Phone": t.phone,
    "Members Count": t.members.length,
    "Abstract URL": t.abstract_url ?? "",
    "Registered On": new Date(t.created_at).toLocaleString(),
  }));
  XLSX.utils.book_append_sheet(wb, buildSheet(teamRoll, "Teams"), "Teams");

  const sum = XLSX.utils.json_to_sheet(summaryRows(scoped));
  sum["!cols"] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, sum, "Summary");

  XLSX.writeFile(wb, `SPECATHON2026_OtherColleges_${TODAY()}.xlsx`);
}

export function exportAllXlsx(teams: FullTeam[]) {
  const internal = teams.filter(isStPeters);
  const external = teams.filter((t) => !isStPeters(t));
  const wb = baseWb();

  // Full detail across every registration, first tab
  XLSX.utils.book_append_sheet(wb, buildSheet(otherRows(teams), "All Participants"), "All Participants");

  if (internal.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet(stPetersRows(internal), "St. Peters"), "St. Peters");
  }
  if (external.length > 0) {
    XLSX.utils.book_append_sheet(wb, buildSheet(otherRows(external), "Other Colleges"), "Other Colleges");
  }

  const sum = XLSX.utils.json_to_sheet(summaryRows(teams));
  sum["!cols"] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, sum, "Summary");

  XLSX.writeFile(wb, `SPECATHON2026_AllRegistrations_${TODAY()}.xlsx`);
}

/* ─── Domain-wise team export ──────────────────────────────────
 * One sheet per domain. One row per TEAM (not per participant).
 * Columns: Registration ID, Team Name, Contact, Email, College,
 *          State, Abstract (clickable hyperlink if URL is present).
 * Called from ExportBar after presigned URLs are resolved externally.
 */

type TeamSummaryRow = {
  "Registration ID": string;
  "Team Name":       string;
  "Team Size":       number;
  "Domain":          string;
  "Contact":         string;
  "Email":           string;
  "College":         string;
  "State":           string;
  "Abstract":        string; // presigned URL or empty
};

export function exportDomainXlsx(
  teams: FullTeam[],
) {
  if (teams.length === 0) return;

  const r2PublicBase = (
    (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
    "https://pub-04614df7e12440b09256674be74d02c4.r2.dev"
  ).replace(/\/$/, "");

  // Group teams by domain, sort domain names alphabetically
  const byDomain = new Map<string, FullTeam[]>();
  for (const t of teams) {
    const d = t.domain || "Unknown";
    const list = byDomain.get(d) ?? [];
    list.push(t);
    byDomain.set(d, list);
  }
  const domains = [...byDomain.keys()].sort();

  const wb = baseWb();

  for (const domain of domains) {
    const domainTeams = byDomain.get(domain)!;

    const rows: TeamSummaryRow[] = domainTeams.map((t) => ({
      "Registration ID": t.reg_code ?? t.id,
      "Team Name":       t.team_name,
      "Team Size":       t.team_size,
      "Domain":          t.domain,
      "Contact":         t.phone,
      "Email":           t.email ?? "",
      "College":         t.college || (t.is_internal ? STPETERS : ""),
      "State":           t.college_state ?? (t.is_internal ? "Telangana" : ""),
      "Abstract":        t.abstract_url
        ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(`${r2PublicBase}/${t.abstract_url}`)}`
        : "",
    }));

    // Build the worksheet manually so we can inject HYPERLINK formulas
    const headers: (keyof TeamSummaryRow)[] = [
      "Registration ID", "Team Name", "Team Size", "Domain",
      "Contact", "Email", "College", "State", "Abstract",
    ];

    const wsData: unknown[][] = [headers];
    for (const row of rows) {
      const abstractUrl = row["Abstract"];
      wsData.push(
        headers.map((h) => {
          if (h === "Abstract" && abstractUrl) {
            // HYPERLINK formula — opens directly in Excel/Google Sheets
            return { f: `HYPERLINK("${abstractUrl}","Open Abstract")`, t: "s" };
          }
          return row[h];
        }),
      );
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws["!cols"] = [
      { wch: 18 }, // Registration ID
      { wch: 28 }, // Team Name
      { wch: 10 }, // Team Size
      { wch: 22 }, // Domain
      { wch: 15 }, // Contact
      { wch: 30 }, // Email
      { wch: 34 }, // College
      { wch: 16 }, // State
      { wch: 18 }, // Abstract
    ];

    // Freeze + style header row
    ws["!views"] = [{ state: "frozen", ySplit: 1 }] as unknown as XLSX.WorkSheet["!views"];
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      const cell = ws[addr];
      if (!cell) continue;
      cell.s = {
        font:      { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
        fill:      { fgColor: { rgb: "186275" } },
        alignment: { horizontal: "left", vertical: "center" },
      };
    }
    ws["!rows"] = [{ hpt: 22 }];

    // Tab name: truncate domain to 31 chars (Excel limit)
    const tabName = domain.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, tabName);
  }

  XLSX.writeFile(wb, `SPECATHON2026_DomainWise_${TODAY()}.xlsx`);
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return (
    headers.join(",") + "\r\n" +
    rows.map((r) => headers.map((h) => esc(r[h])).join(",")).join("\r\n") + "\r\n"
  );
}

export function exportStPetersCsv(teams: FullTeam[]) {
  const csv = toCsv(stPetersRows(teams.filter(isStPeters)));
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SPECATHON2026_StPeters_${TODAY()}.csv`);
}
export function exportOthersCsv(teams: FullTeam[]) {
  const csv = toCsv(otherRows(teams.filter((t) => !isStPeters(t))));
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SPECATHON2026_OtherColleges_${TODAY()}.csv`);
}
export function exportAllCsv(teams: FullTeam[]) {
  const csv = toCsv(otherRows(teams));
  saveBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), `SPECATHON2026_AllRegistrations_${TODAY()}.csv`);
}

/* ─── PDF ─────────────────────────────────────────────────────── */

function pdfHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(11, 15, 20);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(140, 150, 170);
  doc.text(subtitle, 14, 22);
}

function pdfSection(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 14, y);
  doc.setDrawColor(200);
  doc.line(14, y + 2, doc.internal.pageSize.getWidth() - 14, y + 2);
  return y + 8;
}

export function exportStPetersPdf(teams: FullTeam[]) {
  const scoped = teams.filter(isStPeters);
  const doc = new jsPDF({ orientation: "landscape" });
  pdfHeader(
    doc,
    "SPECATHON 2026 · St. Peter's Registrations",
    `Total Teams: ${scoped.length}  ·  Total Participants: ${scoped.reduce((n, t) => n + 1 + t.members.length, 0)}  ·  Generated ${new Date().toLocaleString()}`
  );
  const rows = stPetersRows(scoped).map((r) => [
    r.Role, r["Team Name"], r["Team Size"], r.Domain,
    r.Name, r.Year, r["Roll Number"], r.Department, r.Phone,
  ]);
  autoTable(doc, {
    startY: 40,
    head: [["Role", "Team", "Size", "Domain", "Name", "Year", "Roll No.", "Dept.", "Phone"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [24, 98, 117], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
  });
  doc.save(`SPECATHON2026_StPeters_${TODAY()}.pdf`);
}

export function exportOthersPdf(teams: FullTeam[]) {
  const scoped = teams.filter((t) => !isStPeters(t));
  const doc = new jsPDF({ orientation: "landscape" });
  pdfHeader(
    doc,
    "SPECATHON 2026 · Other College Registrations",
    `Total Teams: ${scoped.length}  ·  Total Participants: ${scoped.reduce((n, t) => n + 1 + t.members.length, 0)}  ·  Generated ${new Date().toLocaleString()}`
  );
  const rows = otherRows(scoped).map((r) => [
    r.Role, r["Team Name"], r["Team Size"], r.Domain,
    r.College, r["College State"], r.Name, r.Phone,
  ]);
  autoTable(doc, {
    startY: 40,
    head: [["Role", "Team", "Size", "Domain", "College", "State", "Name", "Phone"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [24, 98, 117], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 250] },
  });
  doc.save(`SPECATHON2026_OtherColleges_${TODAY()}.pdf`);
}

export function exportAllPdf(teams: FullTeam[]) {
  const internal = teams.filter(isStPeters);
  const external = teams.filter((t) => !isStPeters(t));
  const doc = new jsPDF({ orientation: "landscape" });
  pdfHeader(doc, "SPECATHON 2026 · All Registrations", `Generated ${new Date().toLocaleString()}`);

  let y = pdfSection(doc, "Summary", 40);
  const sum = summaryRows(teams).map((r) => [r.Metric, String(r.Value)]);
  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: sum,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [24, 98, 117], textColor: 255 },
  });
  // @ts-expect-error lastAutoTable is added by jspdf-autotable at runtime
  y = doc.lastAutoTable.finalY + 10;

  if (internal.length > 0) {
    y = pdfSection(doc, "St. Peter's Engineering College", y);
    autoTable(doc, {
      startY: y,
      head: [["Role", "Team", "Size", "Domain", "Name", "Year", "Roll No.", "Dept.", "Phone"]],
      body: stPetersRows(internal).map((r) => [
        r.Role, r["Team Name"], r["Team Size"], r.Domain,
        r.Name, r.Year, r["Roll Number"], r.Department, r.Phone,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [24, 98, 117], textColor: 255 },
    });
  }

  if (external.length > 0) {
    doc.addPage();
    y = pdfSection(doc, "Other Colleges", 20);
    autoTable(doc, {
      startY: y,
      head: [["Role", "Team", "Size", "Domain", "College", "State", "Name", "Phone"]],
      body: otherRows(external).map((r) => [
        r.Role, r["Team Name"], r["Team Size"], r.Domain,
        r.College, r["College State"], r.Name, r.Phone,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [24, 98, 117], textColor: 255 },
    });
  }

  doc.save(`SPECATHON2026_AllRegistrations_${TODAY()}.pdf`);
}
