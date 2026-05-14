import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock mammoth BEFORE importing the module under test.
const convertToHtmlMock = vi.fn();
vi.mock("mammoth", () => ({ default: { convertToHtml: convertToHtmlMock } }));

// Dynamic import so the mock is in place when the module initialises.
const { parsePolicyDoc } = await import("@/lib/policy-doc/parser");

// ─── HTML fixture helpers ──────────────────────────────────────────────────

function makeReviewTable(rows: string[][]): string {
  const header = `<tr><th>Date</th><th>Reviewed Version</th><th>Changes Required</th><th>Reviewed By</th><th>Approved By</th></tr>`;
  const dataRows = rows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table>${header}${dataRows}</table>`;
}

function makeRevisionTable(rows: string[][]): string {
  const header = `<tr><th>Date</th><th>Initial Version</th><th>Description</th><th>Pages</th><th>Proposed By</th><th>Changed By</th><th>Final Version</th><th>Approved By</th></tr>`;
  const dataRows = rows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table>${header}${dataRows}</table>`;
}

const REVIEW_H2 = `<h2>Review History</h2>`;
const REVISION_H2 = `<h2>Revision History</h2>`;

// ─── Tests ────────────────────────────────────────────────────────────────

describe("parsePolicyDoc", () => {
  beforeEach(() => {
    convertToHtmlMock.mockReset();
  });

  // 1. Happy path with full metadata tables
  it("returns full parsed doc with both history tables", async () => {
    const reviewTable = makeReviewTable([
      ["2026-01-01", "0.9.0", "Minor edits", "Alice", "Bob"],
    ]);
    const revisionTable = makeRevisionTable([
      ["2026-01-12", "0.9.0", "Initial release", "1-5", "Alice", "Bob", "1.0.0", "CEO"],
    ]);
    const html = `<h1 class="policy-h1">Access Control Policy</h1><p>Body text.</p>${REVIEW_H2}${reviewTable}${REVISION_H2}${revisionTable}`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "TSPL-ISMS-POL-002 - Access Control Policy.docx");

    expect(result.renderMode).toBe("PARSED");
    expect(result.documentTitle).toBe("Access Control Policy");

    // Review history
    expect(result.reviewHistory).toHaveLength(1);
    expect(result.reviewHistory[0].reviewedVersion).toBe("0.9.0");
    expect(result.reviewHistory[0].approvedBy).toBe("Bob");

    // Revision history
    expect(result.revisionHistory).toHaveLength(1);
    expect(result.revisionHistory[0].finalVersion).toBe("1.0.0");
    expect(result.revisionHistory[0].approvedBy).toBe("CEO");

    // sourceVersion from revision's finalVersion
    expect(result.sourceVersion).toBe("1.0.0");
    // approver from revision's approvedBy
    expect(result.approver).toBe("CEO");

    // renderedHTMLHash is a 64-char hex string
    expect(result.renderedHTMLHash).toMatch(/^[0-9a-f]{64}$/);

    // Stripped headers must not appear in renderedHTML
    expect(result.renderedHTML).not.toMatch(/Review History/i);
    expect(result.renderedHTML).not.toMatch(/Revision History/i);
  });

  // 2. sourceVersion falls back to reviewedVersion when no revision table
  it("falls back to reviewedVersion when revision table absent", async () => {
    const reviewTable = makeReviewTable([
      ["2026-01-01", "0.5.0", "No changes", "Alice", "Bob"],
    ]);
    const html = `<h1>My Policy</h1>${REVIEW_H2}${reviewTable}`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.sourceVersion).toBe("0.5.0");
    expect(result.revisionHistory).toHaveLength(0);
  });

  // 3. sourceVersion defaults to "0.0.0" when both tables empty
  it('defaults sourceVersion to "0.0.0" and nulls when both tables absent', async () => {
    const html = `<h1>Bare Policy</h1><p>Nothing here.</p>`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.sourceVersion).toBe("0.0.0");
    expect(result.approver).toBeNull();
    expect(result.approvedOn).toBeNull();
  });

  // 4. documentTitle falls back to fileName when no H1
  it("derives documentTitle from fileName when H1 is absent", async () => {
    const html = `<p>Just a paragraph.</p>`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(
      Buffer.from(""),
      "TSPL-ISMS-POL-002 - Access Control Policy.docx",
    );

    expect(result.documentTitle).toBe("Access Control Policy");
  });

  // 5. fileNameToCode: happy path and miss
  it("extracts documentCode from well-formed fileName and returns null for random name", async () => {
    convertToHtmlMock.mockResolvedValue({ value: "<p>x</p>", messages: [] });

    const withCode = await parsePolicyDoc(
      Buffer.from(""),
      "TSPL-ISMS-POL-002 - Access Control Policy.docx",
    );
    expect(withCode.documentCode).toBe("TSPL-ISMS-POL-002");

    const withoutCode = await parsePolicyDoc(Buffer.from(""), "random.docx");
    expect(withoutCode.documentCode).toBeNull();
  });

  // 6. Table of Contents block stripped
  it("strips Table of Contents header and TOC anchor links", async () => {
    const html = [
      "<h1>My Policy</h1>",
      "<p><strong>Table of Contents</strong></p>",
      `<p><a href="#_Toc1234">Section One\tpage 1</a></p>`,
      `<p><a href="#_Toc5678">Section Two\tpage 3</a></p>`,
      "<p>Real body content.</p>",
    ].join("");

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.renderedHTML).not.toContain("Table of Contents");
    expect(result.renderedHTML).not.toContain("#_Toc1234");
    expect(result.renderedHTML).not.toContain("#_Toc5678");
    // Real content preserved
    expect(result.renderedHTML).toContain("Real body content.");
  });

  // 7. DOMPurify strips disallowed tags
  it("DOMPurify removes script and img tags but preserves p and h1", async () => {
    const html = [
      "<h1>Policy</h1>",
      "<p>Safe paragraph.</p>",
      "<script>alert(1)</script>",
      "<img src=x onerror=alert(1)>",
    ].join("");

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.renderedHTML).not.toContain("<script");
    expect(result.renderedHTML).not.toContain("<img");
    expect(result.renderedHTML).toContain("<h1");
    expect(result.renderedHTML).toContain("<p>");
  });

  // 8. Warnings forwarded from mammoth, info filtered out
  it("forwards mammoth warnings and filters out info messages", async () => {
    const html = "<h1>Policy</h1>";
    convertToHtmlMock.mockResolvedValue({
      value: html,
      messages: [
        { type: "warning", message: "Unknown style" },
        { type: "info", message: "ignored" },
      ],
    });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.warnings).toEqual(["Unknown style"]);
  });

  // 9. parseDocxDate ISO format
  it("parses ISO date string in revision table to Date at 00:00 UTC", async () => {
    const revisionTable = makeRevisionTable([
      ["2026-01-12", "0.9.0", "Fix", "1", "Alice", "Bob", "1.0.0", "CEO"],
    ]);
    const html = `<h1>Policy</h1>${REVISION_H2}${revisionTable}`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.approvedOn).toBeInstanceOf(Date);
    expect(result.approvedOn!.toISOString()).toBe("2026-01-12T00:00:00.000Z");
  });

  // 10. parseDocxDate invalid string yields null
  it("returns null approvedOn when date cell contains invalid string", async () => {
    const revisionTable = makeRevisionTable([
      ["not a date", "0.9.0", "Fix", "1", "Alice", "Bob", "1.0.0", "CEO"],
    ]);
    const html = `<h1>Policy</h1>${REVISION_H2}${revisionTable}`;

    convertToHtmlMock.mockResolvedValue({ value: html, messages: [] });

    const result = await parsePolicyDoc(Buffer.from(""), "policy.docx");

    expect(result.approvedOn).toBeNull();
  });
});
