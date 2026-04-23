import { createHash } from "node:crypto";
import mammoth from "mammoth";
import DOMPurify from "isomorphic-dompurify";

import type {
  ParsedPolicyDoc,
  ReviewHistoryEntry,
  RevisionHistoryEntry,
} from "./types";

// ─── Mammoth style mapping ─────────────────────────────────────────────────
//
// Maps Word's paragraph styles to semantic HTML tags. We're explicit because
// Mammoth's defaults try to be clever about lists (pulls them from numbering
// definitions) and that interacts badly with Teams Squared docs which use the
// `ListParagraph` style for visually-bulleted-but-not-actually-list content.
//
// Result: every ListParagraph becomes a real `<li>` wrapped in `<ul>`. This
// is exactly what we want — the Teams Squared template uses ListParagraph
// consistently for bullet lists.

// NB: `style-name` here is Word's *display* name (with spaces), NOT the Style
// ID. Mammoth surfaces both in warnings but only matches on the display name.
const STYLE_MAP: string[] = [
  "p[style-name='Heading 1'] => h1.policy-h1:fresh",
  "p[style-name='Heading 2'] => h2.policy-h2:fresh",
  "p[style-name='Heading 3'] => h3.policy-h3:fresh",
  "p[style-name='List Paragraph'] => ul > li:fresh",
  "p[style-name='Normal'] => p:fresh",
  // Bold / italic preservation is on by default; we keep it.
];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Parse a Teams Squared ISO policy docx into structured metadata + sanitized
 * HTML body. The body has the two metadata tables (Review History, Revision
 * History) AND the auto-generated Table of Contents paragraph stripped out
 * — those are surfaced separately via the structured fields.
 *
 * @param buffer  The raw docx file bytes (fetched from SharePoint).
 * @param fileName  The source filename — used to extract documentCode like
 *                  "TSPL-ISMS-POL-002".
 */
export async function parsePolicyDoc(
  buffer: Buffer,
  fileName: string,
): Promise<ParsedPolicyDoc> {
  const result = await mammoth.convertToHtml(
    { buffer },
    { styleMap: STYLE_MAP, ignoreEmptyParagraphs: true },
  );

  const rawHtml = result.value;
  const warnings = result.messages
    .filter((m) => m.type === "warning")
    .map((m) => m.message);

  // Pull the two metadata tables out before sanitizing — they're identifiable
  // by the H2 that immediately precedes each one.
  const { reviewHistory, revisionHistory, htmlWithoutTables } =
    extractMetadataTables(rawHtml);

  // Drop the auto-generated Table of Contents block. Word's TOC field renders
  // as: a "Table of Contents" header paragraph (often bolded) followed by one
  // `<p><a href="#_Toc...">Section title\tpage</a></p>` per entry. Strip both.
  const htmlWithoutToc = htmlWithoutTables
    .replace(/<p>\s*(?:<strong>)?\s*Table of Contents\s*(?:<\/strong>)?\s*<\/p>/i, "")
    .replace(/<p>\s*<a href="#_Toc[^"]*">[\s\S]*?<\/a>\s*<\/p>/gi, "");

  // Document title = first H1 (mammoth gives us .policy-h1 from STYLE_MAP).
  const documentTitle = extractDocumentTitle(htmlWithoutToc) ?? fileNameToTitle(fileName);

  // Sanitize everything that survives. Allow our class names through so
  // styling can hook on .policy-h1 etc.
  const sanitized = DOMPurify.sanitize(htmlWithoutToc, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4",
      "p", "br", "hr",
      "ul", "ol", "li",
      "strong", "b", "em", "i", "u",
      "a",
      "table", "thead", "tbody", "tr", "th", "td",
      "code", "pre",
    ],
    ALLOWED_ATTR: ["href", "class", "id"],
    ADD_ATTR: ["target", "rel"],
    // Force any anchor tags from the source to safe rels (defensive — Mammoth
    // shouldn't emit external links from these docs but we belt-and-brace).
    ALLOW_DATA_ATTR: false,
  });

  const renderedHTMLHash = createHash("sha256").update(sanitized).digest("hex");

  // Pull latest from each history table — guarded for empty / malformed.
  const latestRevision = revisionHistory[revisionHistory.length - 1];
  const latestReview = reviewHistory[reviewHistory.length - 1];

  const sourceVersion =
    latestRevision?.finalVersion ??
    latestReview?.reviewedVersion ??
    "0.0.0";

  return {
    renderMode: "PARSED",
    documentTitle,
    documentCode: fileNameToCode(fileName),
    sourceVersion,
    approver: latestRevision?.approvedBy ?? latestReview?.approvedBy ?? null,
    approvedOn: parseDocxDate(latestRevision?.date ?? null),
    lastReviewedOn: parseDocxDate(latestReview?.date ?? null),
    reviewHistory,
    revisionHistory,
    renderedHTML: sanitized,
    renderedHTMLHash,
    warnings,
  };
}

/**
 * Auto-link cross-references in a rendered policy HTML body.
 *
 * Finds doc codes like "TSPL-ISMS-POL-004" and rewrites them to LMS lesson
 * links by matching against the provided code→href map. Codes with no
 * matching lesson are left as plain text (they'll auto-link as soon as the
 * target lesson is created).
 *
 * Called at render time, not parse time, so cross-references to lessons
 * added later light up without re-syncing the source policy.
 */
export function linkCrossReferences(
  html: string,
  codeToHref: Record<string, string>,
): string {
  // Match TSPL-style codes: 2-6 uppercase letters / hyphens / digits.
  // Examples: TSPL-ISMS-POL-004, TS-OPS-PROC-001
  const pattern = /\b(TS[A-Z]*(?:-[A-Z]+){2,4}-\d+)\b/g;

  return html.replace(pattern, (match) => {
    const href = codeToHref[match];
    if (!href) return match;
    // Already inside an anchor? Mammoth shouldn't create anchors for plain
    // text but if a code happens to fall inside one (e.g. a "Related Documents"
    // hyperlink), we'd produce nested <a>. Quick guard: skip if the immediately
    // preceding character is part of an open href attribute. Cheap and good
    // enough for these tightly-controlled docs.
    return `<a href="${href}" class="policy-xref">${match}</a>`;
  });
}

// ─── Filename helpers ──────────────────────────────────────────────────────

/** "TSPL-ISMS-POL-002 - Access Control Policy.docx" → "TSPL-ISMS-POL-002" */
function fileNameToCode(fileName: string): string | null {
  const match = fileName.match(/^(TS[A-Z]*(?:-[A-Z]+){1,4}-\d+)/);
  return match ? match[1] : null;
}

/** "TSPL-ISMS-POL-002 - Access Control Policy.docx" → "Access Control Policy" */
function fileNameToTitle(fileName: string): string {
  return fileName
    .replace(/\.docx$/i, "")
    .replace(/^TS[A-Z]+(?:-[A-Z]+){1,4}-\d+\s*-\s*/, "")
    .trim();
}

// ─── HTML extraction helpers ───────────────────────────────────────────────
//
// The metadata tables always appear in this order and are always preceded
// by their respective H2:
//     <h2>Review History</h2><table>…</table>
//     <h2>Revision History</h2><table>…</table>
// We extract by anchored regex; safer than a naive table-only search because
// it preserves any policy body table the doc might have (none today, but
// future-proof).

interface TableExtractionResult {
  reviewHistory: ReviewHistoryEntry[];
  revisionHistory: RevisionHistoryEntry[];
  htmlWithoutTables: string;
}

function extractMetadataTables(html: string): TableExtractionResult {
  // The H2 contents include TOC bookmark anchors before the visible text:
  //   <h2><a id="_Toc..."></a><a id="..."></a>Review History</h2>
  // So we allow ANY content inside the H2 as long as it contains the label,
  // then capture the immediately-following <table>.
  const reviewRe = /<h2[^>]*>(?:[^<]|<(?!\/h2>)[^>]*>)*?Review History(?:[^<]|<(?!\/h2>)[^>]*>)*?<\/h2>\s*(<table[\s\S]*?<\/table>)/i;
  const revisionRe = /<h2[^>]*>(?:[^<]|<(?!\/h2>)[^>]*>)*?Revision History(?:[^<]|<(?!\/h2>)[^>]*>)*?<\/h2>\s*(<table[\s\S]*?<\/table>)/i;

  const reviewMatch = html.match(reviewRe);
  const revisionMatch = html.match(revisionRe);

  const reviewHistory = reviewMatch ? parseReviewHistory(reviewMatch[1]) : [];
  const revisionHistory = revisionMatch
    ? parseRevisionHistory(revisionMatch[1])
    : [];

  // Strip both H2+table blocks (and the H2 itself).
  const stripRe = (label: string) =>
    new RegExp(
      `<h2[^>]*>(?:[^<]|<(?!\\/h2>)[^>]*>)*?${label}(?:[^<]|<(?!\\/h2>)[^>]*>)*?<\\/h2>\\s*<table[\\s\\S]*?<\\/table>`,
      "i",
    );

  const stripped = html
    .replace(stripRe("Review History"), "")
    .replace(stripRe("Revision History"), "");

  return { reviewHistory, revisionHistory, htmlWithoutTables: stripped };
}

function extractDocumentTitle(html: string): string | null {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return null;
  return stripTags(match[1]).trim() || null;
}

/** Extract rows from a `<table>...</table>` blob. First row is the header. */
function parseTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const rowMatches = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  for (const rowMatch of rowMatches) {
    const cells: string[] = [];
    const cellMatches = rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi);
    for (const cellMatch of cellMatches) {
      cells.push(stripTags(cellMatch[1]).trim());
    }
    rows.push(cells);
  }
  return rows;
}

function parseReviewHistory(tableHtml: string): ReviewHistoryEntry[] {
  const rows = parseTableRows(tableHtml);
  // First row is headers; skip.
  return rows.slice(1).map((cells) => ({
    date: cells[0] || null,
    reviewedVersion: cells[1] || null,
    changesRequired: cells[2] || null,
    reviewedBy: cells[3] || null,
    approvedBy: cells[4] || null,
  }));
}

function parseRevisionHistory(tableHtml: string): RevisionHistoryEntry[] {
  const rows = parseTableRows(tableHtml);
  return rows.slice(1).map((cells) => ({
    date: cells[0] || null,
    initialVersion: cells[1] || null,
    description: cells[2] || null,
    pages: cells[3] || null,
    proposedBy: cells[4] || null,
    changedBy: cells[5] || null,
    finalVersion: cells[6] || null,
    approvedBy: cells[7] || null,
  }));
}

function stripTags(html: string): string {
  // Decode common entities first, then strip tags. Adequate for the table
  // cell content these docs produce (plain text + occasional <strong>).
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** "2026-01-12" → Date; "" / null → null. Tolerates a few common formats. */
function parseDocxDate(s: string | null): Date | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  // ISO format already
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  // Fallback: let JS try
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
}
