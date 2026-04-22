/**
 * Shared types for the policy-doc lesson pipeline.
 *
 * - `ReviewHistoryEntry` / `RevisionHistoryEntry` mirror the two metadata
 *   tables every Teams Squared ISO doc starts with. Stored as JSON on
 *   PolicyDocLesson and surfaced in the LMS Document Control panel.
 * - `ParsedPolicyDoc` is what the parser returns: structured metadata
 *   PLUS the sanitized rendered HTML body (metadata tables stripped).
 */

export interface ReviewHistoryEntry {
  date: string | null;
  reviewedVersion: string | null;
  changesRequired: string | null;
  reviewedBy: string | null;
  approvedBy: string | null;
}

export interface RevisionHistoryEntry {
  date: string | null;
  initialVersion: string | null;
  description: string | null;
  pages: string | null;
  proposedBy: string | null;
  changedBy: string | null;
  finalVersion: string | null;
  approvedBy: string | null;
}

export type PolicyDocRenderMode = "PARSED" | "EMBED";

export interface ParsedPolicyDoc {
  /** Render mode. Currently always "PARSED"; "EMBED" reserved for future
   *  fallback when the source contains images / complex tables. */
  renderMode: PolicyDocRenderMode;

  /** H1 from the body, e.g. "Access Control Policy". */
  documentTitle: string;
  /** Doc code parsed from the source filename, e.g. "TSPL-ISMS-POL-002". */
  documentCode: string | null;

  /** Latest version from Revision History (Final Version column of last row). */
  sourceVersion: string;
  /** Latest approver from Revision History (Approved by column of last row). */
  approver: string | null;
  /** Latest approval date from Revision History (Date column of last row). */
  approvedOn: Date | null;
  /** Latest review date from Review History (Date column of last row). */
  lastReviewedOn: Date | null;

  reviewHistory: ReviewHistoryEntry[];
  revisionHistory: RevisionHistoryEntry[];

  /** Sanitized HTML body, with metadata tables and TOC placeholder removed.
   *  Cross-references like "TSPL-ISMS-POL-004" are NOT linked yet — that's
   *  done at render time on the server (so links light up automatically as
   *  more policy lessons get added). */
  renderedHTML: string;
  /** sha256 of `renderedHTML`. Pinned to LessonProgress on acknowledgement
   *  so audits can prove byte-for-byte what the user saw. */
  renderedHTMLHash: string;

  /** Mammoth/parser warnings — surfaced to admin in the preview UI. */
  warnings: string[];
}
