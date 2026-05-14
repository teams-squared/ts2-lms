import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {},
  prisma: { emailSignature: { findUnique: vi.fn() } },
}));

import { renderEmailSignatureHtml, DEFAULT_SIGNATURE_DISCLAIMER } from "@/lib/email";

function blankSig() {
  return {
    enabled: true,
    signOff: "",
    name: "",
    title: "",
    email: "",
    phone: "",
    websiteUrl: "",
    websiteLabel: "",
    addressLine: "",
    logoUrl: "",
    disclaimer: "",
  };
}

describe("renderEmailSignatureHtml", () => {
  it("returns empty when sig is null", () => {
    expect(renderEmailSignatureHtml(null)).toBe("");
  });

  it("returns empty when sig is disabled", () => {
    expect(renderEmailSignatureHtml({ ...blankSig(), enabled: false })).toBe("");
  });

  it("returns empty when every field is blank", () => {
    expect(renderEmailSignatureHtml(blankSig())).toBe("");
  });

  it("renders an identity-only block (no disclaimer)", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      name: "Akil",
      title: "PM",
    });
    expect(html).toContain("Akil");
    expect(html).toContain("PM");
    expect(html).not.toContain("confidential");
  });

  it("renders a disclaimer-only block (no identity rows)", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      disclaimer: "Be advised.",
    });
    expect(html).toContain("Be advised.");
    // No name/title/email markup expected.
    expect(html).not.toContain("font-weight: 700");
  });

  it("includes a sign-off line only when identity AND signOff are both present", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      signOff: "Best,",
      name: "Akil",
    });
    expect(html).toContain("Best,");

    // signOff alone (no identity) → no sign-off line.
    const onlySignOff = renderEmailSignatureHtml({
      ...blankSig(),
      signOff: "Best,",
    });
    expect(onlySignOff).toBe("");
  });

  it("uses websiteLabel when provided, falls back to URL otherwise", () => {
    const withLabel = renderEmailSignatureHtml({
      ...blankSig(),
      name: "Akil",
      websiteUrl: "https://example.com",
      websiteLabel: "Visit us",
    });
    expect(withLabel).toContain("Visit us");
    expect(withLabel).not.toMatch(/>https:\/\/example\.com</);

    const withoutLabel = renderEmailSignatureHtml({
      ...blankSig(),
      name: "Akil",
      websiteUrl: "https://example.com",
    });
    expect(withoutLabel).toContain("https://example.com");
  });

  it("falls back to the bundled wordmark logo when logoUrl is blank", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      name: "Akil",
    });
    expect(html).toContain("/logo_w_text.png");
  });

  it("uses the admin-supplied logoUrl when present", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      name: "Akil",
      logoUrl: "https://cdn.example.com/logo.svg",
    });
    expect(html).toContain("https://cdn.example.com/logo.svg");
    expect(html).not.toContain("/logo_w_text.png");
  });

  it("escapes HTML in user-supplied identity fields", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      name: 'Akil "Bad" <script>',
      addressLine: "Line & Co.",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Line &amp; Co.");
  });

  it("escapes HTML inside the disclaimer block", () => {
    const html = renderEmailSignatureHtml({
      ...blankSig(),
      disclaimer: "<b>nope</b>",
    });
    expect(html).not.toContain("<b>nope</b>");
    expect(html).toContain("&lt;b&gt;nope&lt;/b&gt;");
  });
});

describe("DEFAULT_SIGNATURE_DISCLAIMER", () => {
  it("is a non-empty string suitable for the 'Use default' button", () => {
    expect(typeof DEFAULT_SIGNATURE_DISCLAIMER).toBe("string");
    expect(DEFAULT_SIGNATURE_DISCLAIMER.length).toBeGreaterThan(200);
    expect(DEFAULT_SIGNATURE_DISCLAIMER).toMatch(/confidential/i);
  });
});
