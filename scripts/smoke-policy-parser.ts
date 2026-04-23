/**
 * Manual smoke-test: feed the three real Teams Squared ISO policy docx
 * files through the parser and dump structured output. Useful to validate
 * the parser without needing a SharePoint connection.
 *
 * Run: `npx tsx scripts/smoke-policy-parser.ts`
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parsePolicyDoc } from "../src/lib/policy-doc/parser";

const DOCS_DIR =
  "C:\\Users\\akilf\\Documents\\Projects\\LMS Courses\\Cybersecurity ISO Onboarding\\Documents";

const files = [
  "TSPL-ISMS-POL-002 - Access Control Policy.docx",
  "TSPL-ISMS-POL-004 - Password & Authentication Policy.docx",
  "TSPL-ISMS-POL-005 - Secure Data Transfer Policy.docx",
];

async function main() {
  for (const file of files) {
    console.log(`\n${"=".repeat(80)}\n=== ${file}\n${"=".repeat(80)}`);
    const buffer = await readFile(path.join(DOCS_DIR, file));
    const parsed = await parsePolicyDoc(buffer, file);

    console.log("documentTitle  :", parsed.documentTitle);
    console.log("documentCode   :", parsed.documentCode);
    console.log("sourceVersion  :", parsed.sourceVersion);
    console.log("approver       :", parsed.approver);
    console.log("approvedOn     :", parsed.approvedOn?.toISOString() ?? null);
    console.log("lastReviewedOn :", parsed.lastReviewedOn?.toISOString() ?? null);
    console.log("reviewHistory  :", parsed.reviewHistory.length, "entries");
    console.log("revisionHistory:", parsed.revisionHistory.length, "entries");
    console.log("renderMode     :", parsed.renderMode);
    console.log("renderedHTML   :", parsed.renderedHTML.length, "chars");
    console.log("hash           :", parsed.renderedHTMLHash.slice(0, 16), "...");
    console.log("warnings       :", parsed.warnings.length);
    if (parsed.warnings.length > 0) {
      for (const w of parsed.warnings.slice(0, 5)) {
        console.log("    -", w);
      }
    }

    console.log("\n--- HTML PREVIEW (first 1500 chars) ---");
    console.log(parsed.renderedHTML.slice(0, 1500));
    console.log("...");
  }
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
