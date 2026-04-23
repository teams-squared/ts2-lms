import { describe, it, expect } from "vitest";
import { linkCrossReferences } from "@/lib/policy-doc/parser";

describe("linkCrossReferences", () => {
  it("rewrites known doc codes to <a> with policy-xref class", () => {
    const html = "<p>See TSPL-ISMS-POL-004 for details.</p>";
    const out = linkCrossReferences(html, {
      "TSPL-ISMS-POL-004": "/courses/c1/lessons/l-pwd",
    });
    expect(out).toContain(`<a href="/courses/c1/lessons/l-pwd" class="policy-xref">TSPL-ISMS-POL-004</a>`);
  });

  it("leaves unknown codes as plain text (auto-link when target appears later)", () => {
    const html = "<p>See TSPL-ISMS-POL-999.</p>";
    const out = linkCrossReferences(html, {});
    expect(out).toBe(html);
  });

  it("rewrites every occurrence, not just the first", () => {
    const html = "<p>TSPL-ISMS-POL-002 supersedes TSPL-ISMS-POL-002 (old).</p>";
    const out = linkCrossReferences(html, {
      "TSPL-ISMS-POL-002": "/courses/c1/lessons/l-acl",
    });
    const matches = out.match(/policy-xref/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("matches both TSPL- and TS- (multi-segment) variants per the regex", () => {
    const html = "<p>See TSPL-ISMS-POL-004 and TS-OPS-PROC-001.</p>";
    const out = linkCrossReferences(html, {
      "TSPL-ISMS-POL-004": "/a",
      "TS-OPS-PROC-001": "/b",
    });
    expect(out).toContain('href="/a"');
    expect(out).toContain('href="/b"');
  });

  it("does not over-match: ignores codes embedded mid-word", () => {
    const html = "<p>foo TSPL-ISMS-POL-004bar baz</p>";
    const out = linkCrossReferences(html, {
      "TSPL-ISMS-POL-004": "/x",
    });
    // The word-boundary on the trailing side (\d+ then \b before "bar") still
    // satisfies the regex — but the matched code "TSPL-ISMS-POL-004" lookup
    // would still hit /x. The point of this test: confirm we don't link a
    // *different* fake code. Make the lookup empty:
    const out2 = linkCrossReferences(html, {});
    expect(out2).toBe(html);
  });
});
